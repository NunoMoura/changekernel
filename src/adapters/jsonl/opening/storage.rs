use super::{
    anchor_matches,
    codec::{self, Anchor, Incident, Prefix},
    initial_prefix, validate, OpeningIoEvent, OpeningIoFault, OpeningIoHook, OpeningMode,
    OpeningSlot,
};
use serde_core::{Deserialize, Serialize};
use std::{
    ffi::CString,
    fs::{self, File},
    io::{Read, Write},
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::{ffi::OsStrExt, fs::MetadataExt},
    },
    path::{Component, Path},
};

#[derive(Debug)]
pub(super) struct Failure {
    issue: &'static str,
    observed: bool,
}
impl Failure {
    pub fn damage() -> Self {
        Self {
            issue: "inconsistent",
            observed: false,
        }
    }
    fn io() -> Self {
        Self {
            issue: "io",
            observed: true,
        }
    }
    fn barrier() -> Self {
        Self {
            issue: "barrier",
            observed: true,
        }
    }
    fn short() -> Self {
        Self {
            issue: "short_write",
            observed: true,
        }
    }
}
// O_NOFOLLOW at every path component; all owning descriptors are close-on-exec.
fn directory(path: &Path) -> Result<File, Failure> {
    if !path.is_absolute()
        || path.as_os_str().len() > 4096
        || path
            .to_str()
            .is_none_or(|s| s.chars().any(char::is_control))
    {
        return Err(Failure::damage());
    }
    let mut dir = File::open("/").map_err(|_| Failure::io())?;
    for component in path.components() {
        match component {
            Component::RootDir => (),
            Component::Normal(name) => {
                dir = at(&dir, name.as_bytes(), libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
            }
            _ => return Err(Failure::damage()),
        }
    }
    // components() normalizes embedded '.', so reject original spelling too.
    if path
        .as_os_str()
        .as_bytes()
        .split(|b| *b == b'/')
        .any(|s| s == b"." || s == b"..")
    {
        return Err(Failure::damage());
    }
    Ok(dir)
}
fn at(dir: &File, name: &[u8], flags: i32, mode: u32) -> Result<File, Failure> {
    let name = CString::new(name).map_err(|_| Failure::damage())?;
    // SAFETY: valid directory fd and NUL-terminated filename; returned fd is uniquely owned.
    let fd = unsafe {
        libc::openat(
            dir.as_raw_fd(),
            name.as_ptr(),
            flags | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK,
            mode,
        )
    };
    if fd < 0 {
        let err = std::io::Error::last_os_error();
        return Err(
            if matches!(
                err.raw_os_error(),
                Some(libc::EEXIST | libc::ELOOP | libc::ENOENT | libc::ENOTDIR)
            ) {
                Failure::damage()
            } else {
                Failure::io()
            },
        );
    }
    // SAFETY: openat succeeded and ownership is transferred exactly once.
    let f = unsafe { File::from_raw_fd(fd) };
    if flags & libc::O_DIRECTORY == 0 && !f.metadata().map_err(|_| Failure::io())?.is_file() {
        return Err(Failure::damage());
    }
    Ok(f)
}
fn read_file(mut f: File, limit: usize) -> Result<Vec<u8>, Failure> {
    if f.metadata().map_err(|_| Failure::io())?.len() > limit as u64 {
        return Err(Failure::damage());
    }
    let mut b = Vec::new();
    (&mut f)
        .take(limit as u64 + 1)
        .read_to_end(&mut b)
        .map_err(|_| Failure::io())?;
    if b.len() > limit {
        return Err(Failure::damage());
    }
    Ok(b)
}
fn id(f: &File) -> Result<(u64, u64), Failure> {
    let m = f.metadata().map_err(|_| Failure::io())?;
    Ok((m.dev(), m.ino()))
}
fn exists_at(dir: &File, name: &str) -> Result<bool, Failure> {
    let name = CString::new(name).map_err(|_| Failure::damage())?;
    let mut st = std::mem::MaybeUninit::<libc::stat>::uninit();
    // SAFETY: stat storage and filename are valid; no follow occurs.
    let result = unsafe {
        libc::fstatat(
            dir.as_raw_fd(),
            name.as_ptr(),
            st.as_mut_ptr(),
            libc::AT_SYMLINK_NOFOLLOW,
        )
    };
    if result == 0 {
        return Ok(true);
    }
    if std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT) {
        Ok(false)
    } else {
        Err(Failure::io())
    }
}
fn unlink(dir: &File, name: &str) -> Result<(), Failure> {
    let name = CString::new(name).map_err(|_| Failure::damage())?;
    // SAFETY: directory and filename valid; no recursive or path-selected deletion.
    if unsafe { libc::unlinkat(dir.as_raw_fd(), name.as_ptr(), 0) } != 0 {
        return Err(Failure::io());
    }
    Ok(())
}
fn rename(dir: &File, from: &str, to: &str) -> Result<(), Failure> {
    let from = CString::new(from).map_err(|_| Failure::damage())?;
    let to = CString::new(to).map_err(|_| Failure::damage())?;
    // SAFETY: same pinned parent, valid fds and filenames.
    if unsafe { libc::renameat(dir.as_raw_fd(), from.as_ptr(), dir.as_raw_fd(), to.as_ptr()) } != 0
    {
        return Err(Failure::io());
    }
    Ok(())
}
pub(super) struct Storage {
    slot: OpeningSlot,
    dir: File,
    lock: File,
    parent: File,
    anchor_name: String,
    anchor: Anchor,
    hook: Option<OpeningIoHook>,
    pub phase: &'static str,
    pub latched: bool,
}
impl Storage {
    pub fn connect(
        slot: OpeningSlot,
        mode: OpeningMode,
        mut hook: Option<OpeningIoHook>,
    ) -> Result<Self, Failure> {
        let parent_path = slot.anchor.parent().ok_or_else(Failure::damage)?;
        let anchor_name = slot
            .anchor
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(Failure::damage)?
            .to_owned();
        if anchor_name == "anchor.tmp"
            || parent_path.starts_with(&slot.directory)
            || slot.directory.file_name().is_none()
        {
            return Err(Failure::damage());
        }
        let parent = directory(parent_path)?;
        let slot_parent = directory(slot.directory.parent().ok_or_else(Failure::damage)?)?;
        let fresh = mode == OpeningMode::FreshProvision;
        if fresh {
            if exists_at(&parent, &anchor_name)? || exists_at(&parent, "anchor.tmp")? {
                return Err(Failure::damage());
            }
            let n = CString::new(slot.directory.file_name().unwrap().as_bytes())
                .map_err(|_| Failure::damage())?;
            // SAFETY: pinned parent fd, valid name, exclusive mkdir.
            if unsafe { libc::mkdirat(slot_parent.as_raw_fd(), n.as_ptr(), 0o700) } != 0 {
                return Err(Failure::damage());
            }
            if let Some(h) = hook.as_mut() {
                if h(OpeningIoEvent {
                    phase: "provision",
                    object: "directory",
                    step: "created",
                }) != OpeningIoFault::Continue
                {
                    return Err(Failure::io());
                }
            }
        }
        let dir = directory(&slot.directory)?;
        let lock = at(
            &dir,
            b"writer.lock",
            if fresh {
                libc::O_RDWR | libc::O_CREAT | libc::O_EXCL
            } else {
                libc::O_RDWR
            },
            0o600,
        )?;
        // SAFETY: held permanent lock file; advisory exclusive nonblocking flock.
        if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err(Failure::damage());
        }
        let anchor = if fresh {
            let (directory_device, directory_inode) = id(&dir)?;
            let (lock_device, lock_inode) = id(&lock)?;
            Anchor {
                format: "ck-opening-anchor@1".into(),
                custody: "custody-1".into(),
                workspace_id: "workspace-1".into(),
                binding: "fixture@1".into(),
                change: "change-1".into(),
                owner: "owner-1".into(),
                key: "open-1".into(),
                directory: slot
                    .directory
                    .to_str()
                    .ok_or_else(Failure::damage)?
                    .to_owned(),
                directory_device,
                directory_inode,
                lock_device,
                lock_inode,
                stage: "preparing".into(),
            }
        } else {
            codec::retained(&read_file(
                at(&parent, anchor_name.as_bytes(), libc::O_RDONLY, 0)?,
                codec::LIMIT,
            )?)
            .map_err(|_| Failure::damage())?
        };
        if !anchor_matches(&anchor, &slot)
            || (mode == OpeningMode::Reopen && anchor.stage != "installed")
            || (mode == OpeningMode::ResumeProvision && anchor.stage != "preparing")
        {
            return Err(Failure::damage());
        }
        let mut s = Self {
            slot,
            dir,
            lock,
            parent,
            anchor_name,
            anchor,
            hook,
            phase: "provision",
            latched: false,
        };
        let result = (|| {
            if fresh {
                s.event("writer.lock", "created")?;
                s.event("writer.lock", "before_sync")?;
                s.lock.sync_all().map_err(|_| Failure::barrier())?;
                s.event("writer.lock", "synced")?;
                s.sync_directory()?;
                s.event("directory_parent", "before_sync")?;
                slot_parent.sync_all().map_err(|_| Failure::barrier())?;
                s.event("directory_parent", "synced")?;
                let name = s.anchor_name.clone();
                let f = at(
                    &s.parent,
                    name.as_bytes(),
                    libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
                    0o600,
                )?;
                let bytes = codec::emit(&s.anchor).map_err(|_| Failure::damage())?;
                s.write_file(f, &bytes, "anchor.json")?;
                s.event("anchor.json", "before_parent_sync")?;
                s.sync_parent()?;
                s.event("anchor.json", "parent_synced")?;
            }
            s.identity()?;
            s.anchor_temporary()?;
            if s.anchor.stage == "preparing" {
                s.inventory(true)?;
                // Existing controls must be deterministic initial values, never overwritten.
                for (name, bytes) in s.initial_controls()? {
                    if s.exists(name)? {
                        if s.read(name, codec::LIMIT)? != bytes {
                            return Err(Failure::damage());
                        }
                    } else {
                        s.event(name, "before_create")?;
                        let f = at(
                            &s.dir,
                            name.as_bytes(),
                            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
                            0o600,
                        )?;
                        s.event(name, "created")?;
                        s.write_file(f, &bytes, name)?;
                    }
                }
                s.initial_inventory()?;
                s.barriers()?;
                s.anchor.stage = "installed".into();
                let bytes = codec::emit(&s.anchor).map_err(|_| Failure::damage())?;
                s.replace_anchor(&bytes)?;
            }
            s.phase = "recover";
            validate(&mut s)?;
            s.barriers()?;
            validate(&mut s)?;
            Ok(())
        })();
        if let Err(e) = result {
            s.retain_failure(&e);
            return Err(e);
        }
        Ok(s)
    }
    pub fn event(
        &mut self,
        object: &'static str,
        step: &'static str,
    ) -> Result<OpeningIoFault, Failure> {
        let action = self.hook.as_mut().map_or(OpeningIoFault::Continue, |h| {
            h(OpeningIoEvent {
                phase: self.phase,
                object,
                step,
            })
        });
        if action == OpeningIoFault::Io {
            Err(Failure::io())
        } else {
            Ok(action)
        }
    }
    fn write_file(
        &mut self,
        mut f: File,
        bytes: &[u8],
        object: &'static str,
    ) -> Result<(), Failure> {
        let short = self.event(object, "before_write")? == OpeningIoFault::ShortWrite;
        let b = if short {
            &bytes[..bytes.len() / 2]
        } else {
            bytes
        };
        // Exactly one write: a short result is uncertainty, not silently retried.
        let count = f.write(b).map_err(|_| Failure::io())?;
        if short || count != bytes.len() {
            self.event(object, "short_written")?;
            return Err(Failure::short());
        }
        self.event(object, "written")?;
        self.event(object, "before_sync")?;
        f.sync_all().map_err(|_| Failure::barrier())?;
        self.event(object, "synced")?;
        Ok(())
    }
    pub fn read(&self, name: &str, limit: usize) -> Result<Vec<u8>, Failure> {
        read_file(at(&self.dir, name.as_bytes(), libc::O_RDONLY, 0)?, limit)
    }
    pub fn read_canonical<T: for<'de> Deserialize<'de> + Serialize>(
        &self,
        name: &str,
    ) -> Result<T, Failure> {
        codec::retained(&self.read(name, codec::LIMIT)?).map_err(|_| Failure::damage())
    }
    pub fn exists(&self, name: &str) -> Result<bool, Failure> {
        exists_at(&self.dir, name)
    }
    pub fn remove(&mut self, name: &'static str) -> Result<(), Failure> {
        self.event(name, "before_unlink")?;
        unlink(&self.dir, name)?;
        self.event(name, "unlinked")?;
        Ok(())
    }
    pub fn sync_control(&mut self, name: &'static str) -> Result<(), Failure> {
        self.event(name, "before_sync")?;
        at(&self.dir, name.as_bytes(), libc::O_RDONLY, 0)?
            .sync_all()
            .map_err(|_| Failure::barrier())?;
        self.event(name, "synced")?;
        Ok(())
    }
    pub fn sync_directory(&mut self) -> Result<(), Failure> {
        self.event("directory", "before_sync")?;
        self.dir.sync_all().map_err(|_| Failure::barrier())?;
        self.event("directory", "synced")?;
        Ok(())
    }
    fn sync_parent(&mut self) -> Result<(), Failure> {
        self.event("anchor_parent", "before_sync")?;
        self.parent.sync_all().map_err(|_| Failure::barrier())?;
        self.event("anchor_parent", "synced")?;
        Ok(())
    }
    pub fn barriers(&mut self) -> Result<(), Failure> {
        self.sync_control("trace.jsonl")?;
        self.sync_control("checkpoint.json")?;
        self.sync_control("incident.json")?;
        self.sync_directory()?;
        self.event("anchor.json", "before_sync")?;
        at(&self.parent, self.anchor_name.as_bytes(), libc::O_RDONLY, 0)?
            .sync_all()
            .map_err(|_| Failure::barrier())?;
        self.event("anchor.json", "synced")?;
        self.sync_parent()
    }
    pub fn identity(&self) -> Result<(), Failure> {
        let a: Anchor = codec::retained(&read_file(
            at(&self.parent, self.anchor_name.as_bytes(), libc::O_RDONLY, 0)?,
            codec::LIMIT,
        )?)
        .map_err(|_| Failure::damage())?;
        if !anchor_matches(&a, &self.slot)
            || a != self.anchor
            || id(&self.dir)? != (a.directory_device, a.directory_inode)
            || id(&self.lock)? != (a.lock_device, a.lock_inode)
            || id(&directory(&self.slot.directory)?)? != id(&self.dir)?
            || id(&at(&self.dir, b"writer.lock", libc::O_RDWR, 0)?)? != id(&self.lock)?
        {
            return Err(Failure::damage());
        }
        Ok(())
    }
    pub fn inventory(&self, preparing: bool) -> Result<(), Failure> {
        let mut names = Vec::new();
        for e in fs::read_dir(&self.slot.directory).map_err(|_| Failure::io())? {
            let e = e.map_err(|_| Failure::io())?;
            let name = e.file_name().into_string().map_err(|_| Failure::damage())?;
            if !matches!(
                name.as_str(),
                "writer.lock"
                    | "trace.jsonl"
                    | "checkpoint.json"
                    | "incident.json"
                    | "checkpoint.tmp"
                    | "incident.tmp"
            ) || !e.file_type().map_err(|_| Failure::io())?.is_file()
            {
                return Err(Failure::damage());
            }
            if preparing && matches!(name.as_str(), "checkpoint.tmp" | "incident.tmp") {
                return Err(Failure::damage());
            }
            names.push(name);
        }
        for n in [
            "writer.lock",
            "trace.jsonl",
            "checkpoint.json",
            "incident.json",
        ] {
            if (!preparing || n == "writer.lock") && !names.iter().any(|s| s == n) {
                return Err(Failure::damage());
            }
        }
        Ok(())
    }
    fn initial_controls(&self) -> Result<Vec<(&'static str, Vec<u8>)>, Failure> {
        Ok(vec![
            ("trace.jsonl", vec![]),
            (
                "checkpoint.json",
                codec::emit(&initial_prefix()).map_err(|_| Failure::damage())?,
            ),
            (
                "incident.json",
                codec::emit(&self.clear_incident()).map_err(|_| Failure::damage())?,
            ),
        ])
    }
    fn clear_incident(&self) -> Incident {
        Incident {
            format: "ck-opening-incident@1".into(),
            custody: "custody-1".into(),
            state: "clear".into(),
            phase: None,
            issue: None,
        }
    }
    fn initial_inventory(&self) -> Result<(), Failure> {
        self.inventory(false)?;
        if self.exists("checkpoint.tmp")? || self.exists("incident.tmp")? {
            return Err(Failure::damage());
        }
        for (name, bytes) in self.initial_controls()? {
            if self.read(name, codec::LIMIT)? != bytes {
                return Err(Failure::damage());
            }
        }
        Ok(())
    }
    fn anchor_temporary(&mut self) -> Result<(), Failure> {
        if exists_at(&self.parent, "anchor.tmp")? {
            self.initial_inventory()?;
            let temp: Anchor = codec::retained(&read_file(
                at(&self.parent, b"anchor.tmp", libc::O_RDONLY, 0)?,
                codec::LIMIT,
            )?)
            .map_err(|_| Failure::damage())?;
            let mut installed = self.anchor.clone();
            installed.stage = "installed".into();
            if temp != self.anchor && !(self.anchor.stage == "preparing" && temp == installed) {
                return Err(Failure::damage());
            }
            self.event("anchor.tmp", "before_unlink")?;
            unlink(&self.parent, "anchor.tmp")?;
            self.event("anchor.tmp", "unlinked")?;
            self.event("anchor.tmp", "before_cleanup_sync")?;
            self.sync_parent()?;
            self.event("anchor.tmp", "cleanup_synced")?;
            self.identity()?;
            self.initial_inventory()?;
        } else {
            // Also closes interrupted cleanup's absent-temporary parent-barrier case.
            self.sync_parent()?;
        }
        Ok(())
    }
    fn replace_anchor(&mut self, bytes: &[u8]) -> Result<(), Failure> {
        let f = at(
            &self.parent,
            b"anchor.tmp",
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
            0o600,
        )?;
        self.event("anchor.tmp", "created")?;
        self.write_file(f, bytes, "anchor.tmp")?;
        self.event("anchor.tmp", "before_rename")?;
        rename(&self.parent, "anchor.tmp", &self.anchor_name)?;
        self.event("anchor.tmp", "renamed")?;
        self.event("anchor.tmp", "before_parent_sync")?;
        self.sync_parent()?;
        self.event("anchor.tmp", "parent_synced")?;
        self.identity()
    }
    fn replace<T: Serialize>(
        &mut self,
        target: &'static str,
        temp: &'static str,
        value: &T,
    ) -> Result<(), Failure> {
        let bytes = codec::emit(value).map_err(|_| Failure::damage())?;
        self.event(temp, "before_create")?;
        let f = at(
            &self.dir,
            temp.as_bytes(),
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
            0o600,
        )?;
        self.event(temp, "created")?;
        self.write_file(f, &bytes, temp)?;
        self.event(temp, "before_rename")?;
        rename(&self.dir, temp, target)?;
        self.event(temp, "renamed")?;
        self.sync_directory()
    }
    pub fn replace_prefix(&mut self, p: &Prefix) -> Result<(), Failure> {
        self.replace("checkpoint.json", "checkpoint.tmp", p)
    }
    pub fn append(&mut self, bytes: &[u8]) -> Result<(), Failure> {
        let mut f = at(
            &self.dir,
            b"trace.jsonl",
            libc::O_WRONLY | libc::O_APPEND,
            0,
        )?;
        let short = self.event("trace.jsonl", "before_write")? == OpeningIoFault::ShortWrite;
        let b = if short {
            &bytes[..bytes.len() / 2]
        } else {
            bytes
        };
        let count = f.write(b).map_err(|_| Failure::io())?;
        if short || count != bytes.len() {
            self.event("trace.jsonl", "short_written")?;
            return Err(Failure::short());
        }
        self.event("trace.jsonl", "written")?;
        Ok(())
    }
    fn valid_incident(&self, i: &Incident) -> bool {
        i.format == "ck-opening-incident@1"
            && i.custody == "custody-1"
            && (i == &self.clear_incident()
                || (i.state == "blocked"
                    && i.phase.as_deref().is_some_and(|p| {
                        matches!(
                            p,
                            "provision"
                                | "reserve"
                                | "append"
                                | "checkpoint"
                                | "deliver"
                                | "recover"
                        )
                    })
                    && i.issue.as_deref().is_some_and(|p| {
                        matches!(p, "io" | "short_write" | "barrier" | "inconsistent")
                    })))
    }
    pub fn check_incident(&self) -> Result<(), Failure> {
        let i: Incident = self.read_canonical("incident.json")?;
        if !self.valid_incident(&i) || i.state != "clear" {
            return Err(Failure::damage());
        }
        if self.exists("incident.tmp")? {
            // Never erase or replace a surviving incident temporary, even if clear.
            let t: Incident = self.read_canonical("incident.tmp")?;
            if !self.valid_incident(&t) || t.state != "clear" {
                return Err(Failure::damage());
            }
            return Err(Failure::damage()); // clear incident replacement is not part of this protocol
        }
        Ok(())
    }
    pub fn retain_failure(&mut self, e: &Failure) {
        if !e.observed {
            return;
        }
        self.latched = true;
        // Preserve all existing blocked/malformed evidence. Never overwrite it with clear.
        if self.exists("incident.tmp").unwrap_or(true) {
            return;
        }
        if self.exists("incident.json").unwrap_or(true) {
            match self.read_canonical::<Incident>("incident.json") {
                Ok(i) if i == self.clear_incident() => (),
                _ => return,
            }
        }
        let i = Incident {
            state: "blocked".into(),
            phase: Some(self.phase.into()),
            issue: Some(e.issue.into()),
            ..self.clear_incident()
        };
        let _ = self.replace("incident.json", "incident.tmp", &i);
    }
}
