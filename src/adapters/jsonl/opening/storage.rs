use super::super::intent_trace::assessment_work::{self as observation, Boundary};
use super::{
    anchor_matches,
    codec::{self, Anchor, Incident},
    initial_prefix, validate, OpeningIoEvent, OpeningIoFault, OpeningIoHook, OpeningMode,
    OpeningSlot,
};
use serde_core::{Deserialize, Serialize};
use std::{
    ffi::CString,
    fs::{self, File},
    io::{Read, Write},
    os::{
        fd::AsRawFd,
        unix::{ffi::OsStrExt, fs::MetadataExt},
    },
    path::Path,
};

use crate::adapters::linux::custody_fs::{self as raw, PrimitiveFields};
pub(crate) use crate::adapters::linux::custody_fs::{
    exists_at, exists_at_capacity, rename, rename_capacity, unlink, unlink_capacity, Failure,
    FieldRanges,
};

fn field_check(bytes: usize, result: Option<bool>) {
    match result {
        None => observation::field_attempt(bytes as u64),
        Some(ok) => observation::field_complete(ok),
    }
}

// O_NOFOLLOW at every path component; all owning descriptors are close-on-exec.
pub(crate) fn directory(path: &Path) -> Result<File, Failure> {
    directory_observed(path, None)
}
pub(crate) fn directory_observed(
    path: &Path,
    observe: Option<&dyn Fn(bool)>,
) -> Result<File, Failure> {
    directory_resources(path, observe, None, None)
}
pub(crate) fn directory_resources(
    path: &Path,
    observe: Option<&dyn Fn(bool)>,
    capacity: Option<&dyn Fn(usize)>,
    field: Option<&dyn Fn(Option<bool>)>,
) -> Result<File, Failure> {
    raw::directory_fields(
        path,
        observe,
        capacity,
        PrimitiveFields {
            checks: Some(&field_check),
            legacy: field,
            ranges: None,
        },
    )
}
/// Optional range-aware observations; legacy callers retain their original
/// callbacks and assessment-work counters, without extra validation or I/O.
pub(crate) fn directory_operands(
    path: &Path,
    observe: Option<&dyn Fn(bool)>,
    capacity: Option<&dyn Fn(usize)>,
    ranges: Option<FieldRanges<'_>>,
) -> Result<File, Failure> {
    raw::directory_fields(
        path,
        observe,
        capacity,
        PrimitiveFields {
            checks: Some(&field_check),
            legacy: None,
            ranges,
        },
    )
}
pub(crate) fn at(dir: &File, name: &[u8], flags: i32, mode: u32) -> Result<File, Failure> {
    at_observed(dir, name, flags, mode, None)
}
pub(crate) fn at_observed(
    dir: &File,
    name: &[u8],
    flags: i32,
    mode: u32,
    observe: Option<&dyn Fn(bool)>,
) -> Result<File, Failure> {
    at_resources(dir, name, flags, mode, observe, None, None)
}
pub(crate) fn at_resources(
    dir: &File,
    name: &[u8],
    flags: i32,
    mode: u32,
    observe: Option<&dyn Fn(bool)>,
    capacity: Option<&dyn Fn(usize)>,
    field: Option<&dyn Fn(Option<bool>)>,
) -> Result<File, Failure> {
    raw::at_fields(
        dir,
        name,
        flags,
        mode,
        observe,
        capacity,
        PrimitiveFields {
            checks: Some(&field_check),
            legacy: field,
            ranges: None,
        },
    )
}
pub(crate) fn at_operands(
    dir: &File,
    name: &[u8],
    flags: i32,
    mode: u32,
    observe: Option<&dyn Fn(bool)>,
    capacity: Option<&dyn Fn(usize)>,
    ranges: Option<FieldRanges<'_>>,
) -> Result<File, Failure> {
    raw::at_fields(
        dir,
        name,
        flags,
        mode,
        observe,
        capacity,
        PrimitiveFields {
            checks: Some(&field_check),
            legacy: None,
            ranges,
        },
    )
}
fn read_file(mut f: File, limit: usize) -> Result<Vec<u8>, Failure> {
    read_file_counted(&mut f, limit, None, false)
}
pub(crate) fn read_file_counted(
    f: &mut File,
    limit: usize,
    observed: Option<&std::cell::Cell<u64>>,
    trace: bool,
) -> Result<Vec<u8>, Failure> {
    read_file_observed(f, limit, observed, trace, None)
}

pub(crate) fn read_file_observed(
    f: &mut File,
    limit: usize,
    observed: Option<&std::cell::Cell<u64>>,
    trace: bool,
    allocated: Option<&std::cell::Cell<usize>>,
) -> Result<Vec<u8>, Failure> {
    read_file_capacity(f, limit, observed, trace, allocated, None, None)
}
pub(crate) fn read_file_capacity(
    f: &mut File,
    limit: usize,
    observed: Option<&std::cell::Cell<u64>>,
    trace: bool,
    allocated: Option<&std::cell::Cell<usize>>,
    capacity: Option<&dyn Fn(usize)>,
    field: Option<&dyn Fn(Option<bool>)>,
) -> Result<Vec<u8>, Failure> {
    let length = f.metadata().map_err(|_| Failure::io())?.len();
    observation::field_attempt(0);
    if let Some(o) = field {
        o(None);
    }
    let bounded = length <= limit as u64;
    observation::field_complete(bounded);
    if let Some(o) = field {
        o(Some(bounded));
    }
    if !bounded {
        return Err(Failure::damage());
    }
    let mut b = Vec::with_capacity(length as usize + 1);
    if let Some(o) = capacity {
        o(b.capacity());
    }
    let result = f.take(length + 1).read_to_end(&mut b);
    if let Some(o) = capacity {
        o(b.capacity());
    }
    if let Some(allocated) = allocated {
        allocated.set(b.capacity());
    }
    // Count bytes actually appended to this buffer even if reading or the
    // metadata-size check fails. This is not syscall/disk/cache accounting.
    if let Some(counter) = observed {
        counter.set(counter.get() + b.len() as u64);
    }
    observation::read_bytes(trace, b.len());
    if trace {
        observation::trace_capacity(b.capacity());
    }
    result.map_err(|_| Failure::io())?;
    observation::field_attempt(0);
    if let Some(o) = field {
        o(None);
    }
    let same_length = b.len() as u64 == length;
    observation::field_complete(same_length);
    if let Some(o) = field {
        o(Some(same_length));
    }
    if !same_length {
        return Err(Failure::damage());
    }
    Ok(b)
}
pub(crate) fn id(f: &File) -> Result<(u64, u64), Failure> {
    let m = f.metadata().map_err(|_| Failure::io())?;
    Ok((m.dev(), m.ino()))
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Profile {
    Opening,
    Intent,
    Assessment,
}
impl Profile {
    fn anchor(self) -> &'static str {
        match self {
            Self::Opening => "ck-opening-anchor@1",
            Self::Intent => "ck-intent-anchor@2",
            Self::Assessment => "ck-assessment-anchor@3",
        }
    }
    fn incident(self) -> &'static str {
        match self {
            Self::Opening => "ck-opening-incident@1",
            Self::Intent => "ck-intent-incident@2",
            Self::Assessment => "ck-assessment-incident@3",
        }
    }
    fn read_anchor(self, bytes: &[u8]) -> Result<Anchor, Failure> {
        if self == Self::Assessment {
            let a: super::super::intent_trace::assessment_codec::AdoptedAnchor =
                codec::retained(bytes).map_err(|_| Failure::damage())?;
            a.base().map_err(|_| Failure::damage())
        } else {
            codec::retained(bytes).map_err(|_| Failure::damage())
        }
    }
    fn anchor_matches(self, a: &Anchor, slot: &OpeningSlot) -> bool {
        let mut old = a.clone();
        old.format = "ck-opening-anchor@1".into();
        a.format == self.anchor() && anchor_matches(&old, slot)
    }
}
pub(crate) struct Storage {
    profile: Profile,
    pub trace_read: std::cell::Cell<u64>,
    pub control_read: std::cell::Cell<u64>,
    pub control_codec: std::cell::Cell<codec::RetainedWork>,
    pub constructed_control_attempts: std::cell::Cell<u64>,
    pub constructed_control_emissions: std::cell::Cell<u64>,
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
        hook: Option<OpeningIoHook>,
    ) -> Result<Self, Failure> {
        Self::connect_profile(slot, mode, hook, Profile::Opening)
    }
    pub fn connect_profile(
        slot: OpeningSlot,
        mode: OpeningMode,
        mut hook: Option<OpeningIoHook>,
        profile: Profile,
    ) -> Result<Self, Failure> {
        let parent_path = slot.anchor.parent().ok_or_else(Failure::damage)?;
        let anchor_name = slot
            .anchor
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(Failure::damage)?
            .to_owned();
        observation::attempt(
            Boundary::SuppliedPath,
            (parent_path.as_os_str().len() + slot.directory.as_os_str().len()) as u64,
            1,
        );
        let inside = parent_path.starts_with(&slot.directory);
        observation::complete(Boundary::SuppliedPath, inside);
        observation::field_attempt(10);
        let invalid_path =
            anchor_name == "anchor.tmp" || inside || slot.directory.file_name().is_none();
        observation::field_complete(!invalid_path);
        if invalid_path {
            return Err(Failure::damage());
        }
        let parent = directory(parent_path)?;
        let slot_parent = directory(slot.directory.parent().ok_or_else(Failure::damage)?)?;
        observation::field_attempt(0);
        let fresh = mode == OpeningMode::FreshProvision;
        observation::field_complete(fresh);
        if fresh {
            observation::field_attempt(0);
            let existing = exists_at(&parent, &anchor_name)? || exists_at(&parent, "anchor.tmp")?;
            observation::field_complete(!existing);
            if existing {
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
                format: profile.anchor().into(),
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
            profile.read_anchor(&read_file(
                at(&parent, anchor_name.as_bytes(), libc::O_RDONLY, 0)?,
                codec::LIMIT,
            )?)?
        };
        observation::field_attempt(8192);
        let associated = profile.anchor_matches(&anchor, &slot);
        observation::field_complete(associated);
        if !associated {
            return Err(Failure::damage());
        }
        // Separate from association: an association refusal never reaches the
        // mode/stage predicate, nor any later Storage identity validation.
        observation::field_attempt(18);
        let invalid_stage = (mode == OpeningMode::Reopen && anchor.stage != "installed")
            || (mode == OpeningMode::ResumeProvision && anchor.stage != "preparing");
        observation::field_complete(!invalid_stage);
        if invalid_stage {
            return Err(Failure::damage());
        }
        let mut s = Self {
            profile,
            trace_read: std::cell::Cell::new(0),
            control_read: std::cell::Cell::new(0),
            control_codec: std::cell::Cell::new(codec::RetainedWork::default()),
            constructed_control_attempts: std::cell::Cell::new(0),
            constructed_control_emissions: std::cell::Cell::new(0),
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
                let bytes = s.emit_anchor(&s.anchor)?;
                s.write_file(f, &bytes, "anchor.json")?;
                s.event("anchor.json", "before_parent_sync")?;
                s.sync_parent()?;
                s.event("anchor.json", "parent_synced")?;
            }
            s.identity()?;
            s.anchor_temporary()?;
            observation::field_attempt(9);
            let preparing = s.anchor.stage == "preparing";
            observation::field_complete(preparing);
            if preparing {
                s.inventory(true)?;
                // Existing controls must be deterministic initial values, never overwritten.
                for (name, bytes) in s.initial_controls()? {
                    if s.exists(name)? {
                        let retained = s.read(name, codec::LIMIT)?;
                        observation::attempt(
                            Boundary::InitialRaw,
                            retained.len().max(bytes.len()) as u64,
                            1,
                        );
                        let equal = retained == bytes;
                        observation::complete(Boundary::InitialRaw, equal);
                        if !equal {
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
                let bytes = s.emit_anchor(&s.anchor)?;
                s.replace_anchor(&bytes)?;
            }
            s.phase = "recover";
            s.validate_profile()?;
            s.barriers()?;
            s.validate_profile()?;
            Ok(())
        })();
        if let Err(e) = result {
            s.retain_failure(&e);
            return Err(e);
        }
        Ok(s)
    }
    fn validate_profile(&mut self) -> Result<(), Failure> {
        match self.profile {
            Profile::Opening => validate(self).map(|_| ()),
            Profile::Intent | Profile::Assessment => {
                super::super::intent_trace::validate_connect(self)
            }
        }
    }
    pub fn profile(&self) -> Profile {
        self.profile
    }
    fn emit_anchor(&self, a: &Anchor) -> Result<Vec<u8>, Failure> {
        if self.profile == Profile::Assessment {
            self.emit_control(&super::super::intent_trace::assessment_codec::AdoptedAnchor::new(a))
        } else {
            self.emit_control(a)
        }
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
    pub fn read(&mut self, name: &str, limit: usize) -> Result<Vec<u8>, Failure> {
        // Profile-3 source-fixture cuts only. A post-read cut follows a fully
        // completed bounded read; it does not emulate a syscall or partial I/O.
        // Old profiles deliberately receive neither additional event.
        if self.profile == Profile::Assessment {
            self.event(read_object(name)?, "before_read")?;
        }
        let counter = if name == "trace.jsonl" {
            &self.trace_read
        } else {
            &self.control_read
        };
        let bytes = read_file_counted(
            &mut at(&self.dir, name.as_bytes(), libc::O_RDONLY, 0)?,
            limit,
            Some(counter),
            name == "trace.jsonl",
        )?;
        if self.profile == Profile::Assessment {
            self.event(read_object(name)?, "read")?;
        }
        Ok(bytes)
    }
    pub fn read_canonical<T: for<'de> Deserialize<'de> + Serialize>(
        &mut self,
        name: &str,
    ) -> Result<T, Failure> {
        let bytes = self.read(name, codec::LIMIT)?;
        self.canonical_control(&bytes)
    }
    fn canonical_control<T: for<'de> Deserialize<'de> + Serialize>(
        &self,
        bytes: &[u8],
    ) -> Result<T, Failure> {
        let mut work = self.control_codec.get();
        let value = codec::retained_counted(bytes, &mut work);
        self.control_codec.set(work);
        value.map_err(|_| Failure::damage())
    }
    fn emit_control<T: Serialize>(&self, value: &T) -> Result<Vec<u8>, Failure> {
        observation::control_construct_attempt();
        self.constructed_control_attempts
            .set(self.constructed_control_attempts.get() + 1);
        let bytes = codec::emit(value).map_err(|_| Failure::damage())?;
        observation::control_construct_complete();
        self.constructed_control_emissions
            .set(self.constructed_control_emissions.get() + 1);
        Ok(bytes)
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
        let bytes = read_file_counted(
            &mut at(&self.parent, self.anchor_name.as_bytes(), libc::O_RDONLY, 0)?,
            codec::LIMIT,
            Some(&self.control_read),
            false,
        )?;
        let a: Anchor = if self.profile == Profile::Assessment {
            let a: super::super::intent_trace::assessment_codec::AdoptedAnchor =
                self.canonical_control(&bytes)?;
            a.base().map_err(|_| Failure::damage())?
        } else {
            self.canonical_control(&bytes)?
        };
        observation::field_attempt(8192);
        let matches = self.profile.anchor_matches(&a, &self.slot);
        observation::field_complete(matches);
        if !matches {
            return Err(Failure::damage());
        }
        observation::attempt(
            Boundary::ControlTyped,
            a.payload().max(self.anchor.payload()) + 64,
            64,
        );
        let equal = a == self.anchor;
        observation::complete(Boundary::ControlTyped, equal);
        if !equal {
            return Err(Failure::damage());
        }
        observation::field_attempt(0);
        let pinned = id(&self.dir)? == (a.directory_device, a.directory_inode)
            && id(&self.lock)? == (a.lock_device, a.lock_inode)
            && id(&directory(&self.slot.directory)?)? == id(&self.dir)?
            && id(&at(&self.dir, b"writer.lock", libc::O_RDWR, 0)?)? == id(&self.lock)?;
        observation::field_complete(pinned);
        if !pinned {
            return Err(Failure::damage());
        }
        Ok(())
    }
    pub fn inventory(&self, preparing: bool) -> Result<(), Failure> {
        let mut names = Vec::new();
        for e in fs::read_dir(&self.slot.directory).map_err(|_| Failure::io())? {
            let e = e.map_err(|_| Failure::io())?;
            let name = e.file_name().into_string().map_err(|_| Failure::damage())?;
            observation::field_attempt(8192);
            let allowed = matches!(
                name.as_str(),
                "writer.lock"
                    | "trace.jsonl"
                    | "checkpoint.json"
                    | "incident.json"
                    | "checkpoint.tmp"
                    | "incident.tmp"
            );
            observation::field_complete(allowed);
            if !allowed {
                return Err(Failure::damage());
            }
            observation::field_attempt(0);
            let regular = e.file_type().map_err(|_| Failure::io())?.is_file();
            observation::field_complete(regular);
            if !regular {
                return Err(Failure::damage());
            }
            observation::field_attempt(24);
            let unexpected =
                preparing && matches!(name.as_str(), "checkpoint.tmp" | "incident.tmp");
            observation::field_complete(!unexpected);
            if unexpected {
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
            observation::field_attempt(8192);
            let missing = (!preparing || n == "writer.lock") && !names.iter().any(|s| s == n);
            observation::field_complete(!missing);
            if missing {
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
                match self.profile {
                    Profile::Opening => self.emit_control(&initial_prefix()),
                    Profile::Assessment => {
                        self.emit_control(&super::super::intent_trace::initial_assessment_prefix())
                    }
                    Profile::Intent => {
                        self.emit_control(&super::super::intent_trace::initial_prefix())
                    }
                }?,
            ),
            ("incident.json", self.emit_control(&self.clear_incident())?),
        ])
    }
    fn clear_incident(&self) -> Incident {
        Incident {
            format: self.profile.incident().into(),
            custody: "custody-1".into(),
            state: "clear".into(),
            phase: None,
            issue: None,
        }
    }
    fn initial_inventory(&mut self) -> Result<(), Failure> {
        self.inventory(false)?;
        observation::field_attempt(0);
        let temporary = self.exists("checkpoint.tmp")? || self.exists("incident.tmp")?;
        observation::field_complete(!temporary);
        if temporary {
            return Err(Failure::damage());
        }
        for (name, bytes) in self.initial_controls()? {
            let retained = self.read(name, codec::LIMIT)?;
            observation::attempt(
                Boundary::InitialRaw,
                retained.len().max(bytes.len()) as u64,
                1,
            );
            let equal = retained == bytes;
            observation::complete(Boundary::InitialRaw, equal);
            if !equal {
                return Err(Failure::damage());
            }
        }
        Ok(())
    }
    fn anchor_temporary(&mut self) -> Result<(), Failure> {
        observation::field_attempt(0);
        let present = exists_at(&self.parent, "anchor.tmp")?;
        observation::field_complete(present);
        if present {
            self.initial_inventory()?;
            let temp: Anchor = self.profile.read_anchor(&read_file(
                at(&self.parent, b"anchor.tmp", libc::O_RDONLY, 0)?,
                codec::LIMIT,
            )?)?;
            let mut installed = self.anchor.clone();
            installed.stage = "installed".into();
            observation::attempt(
                Boundary::ControlTyped,
                temp.payload().max(self.anchor.payload()) + 64,
                64,
            );
            let same = temp == self.anchor;
            observation::complete(Boundary::ControlTyped, same);
            let known = if same {
                true
            } else {
                observation::field_attempt(9);
                let preparing = self.anchor.stage == "preparing";
                observation::field_complete(preparing);
                if preparing {
                    observation::attempt(
                        Boundary::ControlTyped,
                        temp.payload().max(installed.payload()) + 64,
                        64,
                    );
                    let equal = temp == installed;
                    observation::complete(Boundary::ControlTyped, equal);
                    equal
                } else {
                    false
                }
            };
            if !known {
                return Err(Failure::damage());
            }
            observation::cleanup_attempt();
            self.event("anchor.tmp", "before_unlink")?;
            unlink(&self.parent, "anchor.tmp")?;
            self.event("anchor.tmp", "unlinked")?;
            self.event("anchor.tmp", "before_cleanup_sync")?;
            self.sync_parent()?;
            self.event("anchor.tmp", "cleanup_synced")?;
            observation::cleanup_complete();
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
        let bytes = self.emit_control(value)?;
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
    pub fn replace_prefix<T: Serialize>(&mut self, p: &T) -> Result<(), Failure> {
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
        observation::field_attempt(64);
        let family = i.format == self.profile.incident() && i.custody == "custody-1";
        observation::field_complete(family);
        if !family {
            return false;
        }
        let clear = self.clear_incident();
        observation::attempt(Boundary::ControlTyped, i.payload().max(clear.payload()), 64);
        let equal = i == &clear;
        observation::complete(Boundary::ControlTyped, equal);
        if equal {
            return true;
        }
        observation::field_attempt(512);
        let known = i.state == "blocked"
            && i.phase.as_deref().is_some_and(|p| {
                matches!(
                    p,
                    "provision" | "reserve" | "append" | "checkpoint" | "deliver" | "recover"
                )
            })
            && i.issue
                .as_deref()
                .is_some_and(|p| matches!(p, "io" | "short_write" | "barrier" | "inconsistent"));
        observation::field_complete(known);
        known
    }
    pub fn check_incident(&mut self) -> Result<(), Failure> {
        let i: Incident = self.read_canonical("incident.json")?;
        let valid = self.valid_incident(&i);
        observation::field_attempt(5);
        let clear = valid && i.state == "clear";
        observation::field_complete(clear);
        if !clear {
            return Err(Failure::damage());
        }
        observation::field_attempt(0);
        let temporary = self.exists("incident.tmp")?;
        observation::field_complete(!temporary);
        if temporary {
            // Never erase or replace a surviving incident temporary, even if clear.
            let t: Incident = self.read_canonical("incident.tmp")?;
            let valid = self.valid_incident(&t);
            observation::field_attempt(5);
            let clear = valid && t.state == "clear";
            observation::field_complete(clear);
            if !clear {
                return Err(Failure::damage());
            }
            return Err(Failure::damage()); // clear incident replacement is not part of this protocol
        }
        Ok(())
    }
    pub fn retain_failure(&mut self, e: &Failure) {
        observation::field_attempt(0);
        let observed = e.observed;
        observation::field_complete(observed);
        if !observed {
            return;
        }
        observation::retain();
        self.latched = true;
        // Preserve all existing blocked/malformed evidence. Never overwrite it with clear.
        observation::field_attempt(0);
        let temporary = self.exists("incident.tmp").unwrap_or(true);
        observation::field_complete(!temporary);
        if temporary {
            return;
        }
        observation::field_attempt(0);
        let installed = self.exists("incident.json").unwrap_or(true);
        observation::field_complete(installed);
        if installed {
            observation::field_attempt(0);
            match self.read_canonical::<Incident>("incident.json") {
                Ok(i) => {
                    observation::field_complete(true);
                    let clear = self.clear_incident();
                    observation::attempt(
                        Boundary::ControlTyped,
                        i.payload().max(clear.payload()),
                        64,
                    );
                    let equal = i == clear;
                    observation::complete(Boundary::ControlTyped, equal);
                    if !equal {
                        return;
                    }
                }
                _ => {
                    observation::field_complete(false);
                    return;
                }
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

fn read_object(name: &str) -> Result<&'static str, Failure> {
    match name {
        "trace.jsonl" => Ok("trace.jsonl"),
        "checkpoint.json" => Ok("checkpoint.json"),
        "checkpoint.tmp" => Ok("checkpoint.tmp"),
        "incident.json" => Ok("incident.json"),
        "incident.tmp" => Ok("incident.tmp"),
        _ => Err(Failure::damage()),
    }
}
