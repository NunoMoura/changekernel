//! Descriptor-relative collection I/O over the existing opening syscall primitives.
use super::layout::{Layout, Legacy, Slot};
use super::{
    codec::{self, Incident},
    work::{self, Boundary as B, Heap, Owned},
};
use crate::{
    adapters::jsonl::opening::storage::{self as raw, Failure},
    kernel::changes::ledger::C,
};
use serde_core::{Deserialize, Serialize};
use std::{
    cell::Cell,
    ffi::CString,
    fs::File as RawFile,
    io::Write,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};

pub(super) struct TrackedFile {
    file: Option<RawFile>,
    epoch: Cell<u64>,
}
type File = TrackedFile;
impl TrackedFile {
    fn adopt(file: RawFile) -> Self {
        Self {
            file: Some(file),
            epoch: Cell::new(work::epoch()),
        }
    }
    pub fn rebase(&self) {
        self.epoch.set(work::epoch());
    }
    pub fn try_clone(&self) -> std::io::Result<Self> {
        let f = self.file.as_ref().unwrap().try_clone()?;
        work::descriptors(1);
        Ok(Self::adopt(f))
    }
}
impl std::ops::Deref for TrackedFile {
    type Target = RawFile;
    fn deref(&self) -> &RawFile {
        self.file.as_ref().unwrap()
    }
}
impl std::ops::DerefMut for TrackedFile {
    fn deref_mut(&mut self) -> &mut RawFile {
        self.file.as_mut().unwrap()
    }
}
impl Drop for TrackedFile {
    fn drop(&mut self) {
        if self.file.is_some() && self.epoch.get() == work::epoch() {
            work::descriptors(-1);
        }
    }
}
fn fd_event(open: bool) {
    work::descriptors(if open { 1 } else { -1 });
}
fn primitive_field(bytes: usize, words: usize, result: Option<bool>) {
    match result {
        None => work::attempt(B::Fields, bytes, words),
        Some(ok) => work::complete(B::Fields, ok),
    }
}
pub(super) fn directory(path: &std::path::Path) -> Result<File, Failure> {
    let allocation = work::Allocation::new(false);
    raw::directory_operands(
        path,
        Some(&fd_event),
        Some(&|n| allocation.resize(n)),
        Some(&primitive_field),
    )
    .map(File::adopt)
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerIoFault {
    Continue,
    Io,
    ShortWrite,
    Refuse,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LedgerIoEvent {
    /// Zero is shared custody; 1..=16 are private slots, never wire selectors.
    pub scope: u8,
    pub phase: &'static str,
    pub object: &'static str,
    pub step: &'static str,
}
pub type LedgerIoHook = Box<dyn FnMut(LedgerIoEvent) -> LedgerIoFault>;
pub(super) struct Context<P: Layout = Legacy> {
    pub hook: P::Hook,
    pub profile: super::selection::Profile,
    pub phase: &'static str,
    pub latched: [bool; 17],
    // Original failing syscall scope; retention must not reinterpret it.
    pub failure_scope: Option<u8>,
}
impl<P: Layout> Context<P> {
    pub(super) fn identity_event(
        &mut self,
        scope: u8,
        object: super::continuity::LedgerIdentityObject,
        step: super::continuity::LedgerIdentityStep,
    ) -> Result<super::continuity::LedgerContinuityIoFault, Failure> {
        Ok(P::identity(&mut self.hook, scope, object, step))
    }
    fn scoped<T>(&mut self, scope: u8, result: Result<T, Failure>) -> Result<T, Failure> {
        if result.as_ref().is_err_and(|e| e.observed) {
            self.failure_scope.get_or_insert(scope);
        }
        result
    }
    pub fn event(
        &mut self,
        scope: u8,
        object: &'static str,
        step: &'static str,
    ) -> Result<LedgerIoFault, Failure> {
        let fault = P::file(
            &mut self.hook,
            LedgerIoEvent {
                scope,
                phase: self.phase,
                object,
                step,
            },
        )?;
        if self.profile != super::selection::Profile::Ledger {
            let supported = match fault {
                LedgerIoFault::Continue | LedgerIoFault::Refuse => true,
                LedgerIoFault::ShortWrite => step == "before_write",
                LedgerIoFault::Io => {
                    matches!(
                        step,
                        "before_read"
                            | "before_write"
                            | "before_sync"
                            | "before_unlink"
                            | "before_create"
                            | "before_rename"
                    ) || (object == "reply" && step == "before")
                }
            };
            if !supported {
                return Err(Failure::damage());
            }
            if object == "reply" && step == "before" {
                return match fault {
                    LedgerIoFault::Refuse => Err(Failure::damage()),
                    v => Ok(v),
                };
            }
        }
        match fault {
            LedgerIoFault::Refuse => Err(Failure::damage()),
            LedgerIoFault::Io
                if !matches!(
                    step,
                    "before_read"
                        | "before_write"
                        | "before_sync"
                        | "before_unlink"
                        | "before_create"
                        | "before_rename"
                ) =>
            {
                Err(Failure::damage())
            }
            v => Ok(v),
        }
    }
}
pub(super) struct Node<P: Layout = Legacy> {
    pub dir: File,
    pub lock: File,
    pub parent: File,
    pub anchor_name: String,
    pub scope: u8,
    pub profile: super::selection::Profile,
    pub custody: String,
    pub justified: Cell<bool>,
    pub passes: Cell<u64>,
    pub receipt: P::ReceiptSlot,
}
impl<P: Layout> Heap for Node<P> {
    fn heap(&self) -> usize {
        self.anchor_name.capacity() + self.custody.capacity()
    }
}
pub(super) fn regular(dir: &File, name: &str, flags: i32) -> Result<File, Failure> {
    let allocation = work::Allocation::new(false);
    let f = File::adopt(raw::at_operands(
        dir,
        name.as_bytes(),
        flags,
        0o600,
        Some(&fd_event),
        Some(&|n| allocation.resize(n)),
        Some(&primitive_field),
    )?);
    let m = f.metadata().map_err(|_| Failure::io())?;
    if !work::test(B::Fields, 0, 2, || m.is_file() && m.nlink() == 1) {
        return Err(Failure::damage());
    }
    Ok(f)
}
pub(super) fn lock(f: &File) -> Result<(), Failure> {
    // SAFETY: owned regular-file descriptor; nonblocking cooperative exclusion.
    if unsafe { libc::flock(f.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
        let e = std::io::Error::last_os_error();
        return Err(if matches!(e.raw_os_error(), Some(libc::EWOULDBLOCK)) {
            Failure::damage()
        } else {
            Failure::io()
        });
    }
    Ok(())
}
pub(super) fn allowed(name: &str, candidates: &[&str]) -> bool {
    work::test(
        B::Fields,
        name.len()
            .max(candidates.iter().map(|n| n.len()).max().unwrap_or(0)),
        candidates.len(),
        || candidates.contains(&name),
    )
}
pub(super) fn present(names: &[String], target: &str) -> bool {
    work::test(
        B::Fields,
        names
            .iter()
            .map(String::len)
            .sum::<usize>()
            .max(target.len()),
        names.len() + 1,
        || names.iter().any(|n| n == target),
    )
}
pub(super) fn exists_at(dir: &File, name: &str) -> Result<bool, Failure> {
    let allocation = work::Allocation::new(false);
    work::attempt(B::Fields, name.len(), 1);
    let exists = raw::exists_at_capacity(dir, name, Some(&|n| allocation.resize(n)))?;
    work::complete(B::Fields, exists);
    Ok(exists)
}
fn unlink(dir: &File, name: &str) -> Result<(), Failure> {
    let allocation = work::Allocation::new(false);
    raw::unlink_capacity(dir, name, Some(&|n| allocation.resize(n)))
}
fn rename(dir: &File, from: &str, to: &str) -> Result<(), Failure> {
    let allocation = work::Allocation::new(false);
    raw::rename_capacity(dir, from, to, Some(&|n| allocation.resize(n)))
}
pub(super) fn mkdir(dir: &File, name: &str) -> Result<(), Failure> {
    let n = Owned::new(CString::new(name).map_err(|_| Failure::damage())?);
    // SAFETY: pinned parent, single trusted basename; exclusive mkdir.
    if unsafe { libc::mkdirat(dir.as_raw_fd(), n.as_ptr(), 0o700) } != 0 {
        return Err(
            if std::io::Error::last_os_error().raw_os_error() == Some(libc::EEXIST) {
                Failure::damage()
            } else {
                Failure::io()
            },
        );
    }
    Ok(())
}
pub(super) fn subdir(dir: &File, name: &str) -> Result<File, Failure> {
    let allocation = work::Allocation::new(false);
    raw::at_operands(
        dir,
        name.as_bytes(),
        libc::O_RDONLY | libc::O_DIRECTORY,
        0,
        Some(&fd_event),
        Some(&|n| allocation.resize(n)),
        Some(&primitive_field),
    )
    .map(File::adopt)
}
/// One bounded fd-relative inventory, stopping at the first refused name.
pub(super) fn inventory(
    dir: &File,
    max: usize,
    mut allowed: impl FnMut(&str) -> bool,
) -> Result<Owned<Vec<String>>, Failure> {
    // Explicit syscall buffer instead of an opaque libc DIR allocation/cache.
    // This descriptor has its own stream offset, not custody's directory offset.
    let f = subdir(dir, ".")?;
    let mut scratch = Owned::new(vec![0u8; 32768]);
    let _frame = work::Fixed::new(std::mem::size_of::<File>());
    let mut names = Owned::new(Vec::with_capacity(max));
    loop {
        // SAFETY: live directory descriptor and writable fixed-size allocation.
        let n = unsafe {
            libc::syscall(
                libc::SYS_getdents64,
                f.as_raw_fd(),
                scratch.as_mut_ptr(),
                scratch.len(),
            )
        };
        if n < 0 {
            return Err(Failure::io());
        }
        if n == 0 {
            break;
        }
        work::update(|w| {
            w.inventory_buffer_peak = w.inventory_buffer_peak.max(scratch.capacity() as u64)
        });
        let mut at = 0;
        let end = n as usize;
        while at < end {
            if end - at < 20 {
                return Err(Failure::damage());
            }
            let size = u16::from_ne_bytes([scratch[at + 16], scratch[at + 17]]) as usize;
            if size < 20 || at + size > end {
                return Err(Failure::damage());
            }
            let bytes = &scratch[at + 19..at + size];
            let terminator = bytes
                .iter()
                .position(|b| *b == 0)
                .ok_or_else(Failure::damage)?;
            let bytes = &bytes[..terminator];
            at += size;
            if bytes == b"." || bytes == b".." {
                continue;
            }
            work::update(|w| w.inventory_visits += 1);
            work::attempt(B::Fields, bytes.len(), 1);
            let name = match std::str::from_utf8(bytes) {
                Ok(n) => n,
                Err(_) => {
                    work::complete(B::Fields, false);
                    return Err(Failure::damage());
                }
            };
            let known = names.len() < max && allowed(name);
            work::complete(B::Fields, known);
            if !known {
                return Err(Failure::damage());
            }
            names.push(name.to_owned());
            names.refresh();
        }
    }
    Ok(names)
}

impl<P: Layout> Node<P> {
    pub fn binding(&self, members: &File) -> Result<(), Failure> {
        let path = Owned::new(format!("m-{}", self.scope));
        let named = raw::id(&*subdir(members, &path)?)?;
        let held = raw::id(&self.dir)?;
        if !work::test(B::Fields, 0, 2, || named == held) {
            return Err(Failure::damage());
        }
        let named = raw::id(&*regular(&self.dir, "writer.lock", libc::O_RDWR)?)?;
        let held = raw::id(&self.lock)?;
        if !work::test(B::Fields, 0, 2, || named == held) {
            return Err(Failure::damage());
        }
        Ok(())
    }

    pub fn read_at(
        &self,
        ctx: &mut Context<P>,
        dir: &File,
        name: &str,
        object: &'static str,
        limit: usize,
        trace: bool,
    ) -> Result<Owned<Vec<u8>>, Failure> {
        let fault = ctx.event(self.scope, object, "before_read")?;
        work::attempt(B::Reads, limit + 1, 1);
        let mut f = regular(dir, name, libc::O_RDONLY)?;
        if fault == LedgerIoFault::Io {
            // Concrete EBADF read witness, not a post-completed-I/O refusal.
            let mut byte = 0u8;
            // SAFETY: invalid fd, valid one-byte destination; syscall fails without custody mutation.
            let result = unsafe { libc::read(-1, (&mut byte as *mut u8).cast(), 1) };
            if result < 0 {
                return Err(Failure::io());
            }
        }
        let counter = Cell::new(0);
        let allocation = work::Allocation::new(trace);
        let result = raw::read_file_capacity(
            &mut f,
            limit,
            Some(&counter),
            trace,
            None,
            Some(&|n| allocation.resize(n)),
            Some(&|result| match result {
                None => work::attempt(B::Fields, 0, 1),
                Some(ok) => work::complete(B::Fields, ok),
            }),
        );
        let count = counter.get();
        work::update(|w| {
            w.buffered_bytes += count;
            if trace {
                w.trace_bytes += count;
            }
        });
        let bytes = allocation.adopt(result?);
        work::complete(B::Reads, true);
        // A refusal here is explicitly deterministic, not an observed read failure.
        let after = ctx.event(self.scope, object, "read")?;
        if after == LedgerIoFault::Io {
            return Err(Failure::damage());
        }
        Ok(bytes)
    }
    pub fn read(
        &self,
        ctx: &mut Context<P>,
        name: &'static str,
        limit: usize,
    ) -> Result<Owned<Vec<u8>>, Failure> {
        self.read_at(ctx, &self.dir, name, name, limit, name == "trace.jsonl")
    }
    pub fn control<T: for<'de> Deserialize<'de> + Serialize + Heap>(
        &self,
        ctx: &mut Context<P>,
        name: &'static str,
    ) -> Result<Owned<T>, Failure> {
        let bytes = self.read(ctx, name, C)?;
        codec::retained(&bytes, B::Controls).map_err(|_| Failure::damage())
    }
    pub fn anchor<T: for<'de> Deserialize<'de> + Serialize + Heap>(
        &self,
        ctx: &mut Context<P>,
    ) -> Result<Owned<T>, Failure> {
        let bytes = self.read_at(
            ctx,
            &self.parent,
            &self.anchor_name,
            "anchor.json",
            C,
            false,
        )?;
        codec::retained(&bytes, B::Controls).map_err(|_| Failure::damage())
    }
    pub fn sync(
        &self,
        ctx: &mut Context<P>,
        f: &File,
        object: &'static str,
    ) -> Result<(), Failure> {
        let scope = if object == "anchor_parent" {
            0
        } else {
            self.scope
        };
        let result = self.sync_inner(ctx, f, object);
        ctx.scoped(scope, result)
    }
    fn sync_inner(
        &self,
        ctx: &mut Context<P>,
        f: &File,
        object: &'static str,
    ) -> Result<(), Failure> {
        let fault = ctx.event(self.scope, object, "before_sync")?;
        if fault == LedgerIoFault::Io {
            // SAFETY: invalid fd produces a genuine failed barrier syscall.
            if unsafe { libc::fsync(-1) } != 0 {
                return Err(Failure::barrier());
            }
        }
        f.sync_all().map_err(|_| Failure::barrier())?;
        if ctx.event(self.scope, object, "synced")? == LedgerIoFault::Io {
            return Err(Failure::damage());
        }
        Ok(())
    }
    pub fn sync_name(&self, ctx: &mut Context<P>, name: &'static str) -> Result<(), Failure> {
        self.sync(ctx, &regular(&self.dir, name, libc::O_RDONLY)?, name)
    }
    pub fn barriers(&self, ctx: &mut Context<P>) -> Result<(), Failure> {
        self.sync(
            ctx,
            &regular(&self.parent, &self.anchor_name, libc::O_RDONLY)?,
            "anchor.json",
        )?;
        self.sync(ctx, &self.parent, "anchor_parent")?;
        for name in if self.scope == 0 {
            &["creation.json", "incident.json"][..]
        } else {
            &["trace.jsonl", "checkpoint.json", "incident.json"][..]
        } {
            self.sync_name(ctx, name)?;
        }
        self.sync(ctx, &self.dir, "directory")
    }
    fn write_file(
        &self,
        ctx: &mut Context<P>,
        mut f: File,
        bytes: &[u8],
        object: &'static str,
    ) -> Result<(), Failure> {
        let fault = ctx.event(self.scope, object, "before_write")?;
        if fault == LedgerIoFault::Io {
            // SAFETY: invalid fd and valid input span; observed EBADF write.
            if unsafe { libc::write(-1, bytes.as_ptr().cast(), bytes.len()) } < 0 {
                return Err(Failure::io());
            }
        }
        let short = fault == LedgerIoFault::ShortWrite;
        let b = if short {
            &bytes[..bytes.len() / 2]
        } else {
            bytes
        };
        let count = f.write(b).map_err(|_| Failure::io())?;
        if short || count != bytes.len() {
            ctx.event(self.scope, object, "short_written")?;
            return Err(Failure::short());
        }
        if ctx.event(self.scope, object, "written")? == LedgerIoFault::Io {
            return Err(Failure::damage());
        }
        self.sync(ctx, &f, object)
    }
    fn create_fault(&self, ctx: &mut Context<P>, name: &'static str) -> Result<(), Failure> {
        if ctx.event(self.scope, name, "before_create")? == LedgerIoFault::Io {
            let n = Owned::new(CString::new(name).unwrap());
            // SAFETY: invalid dirfd with a relative basename produces EBADF.
            if unsafe {
                libc::openat(
                    -1,
                    n.as_ptr(),
                    libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
                    0o600,
                )
            } < 0
            {
                return Err(Failure::io());
            }
        }
        Ok(())
    }
    pub fn create(
        &self,
        ctx: &mut Context<P>,
        name: &'static str,
        bytes: &[u8],
    ) -> Result<(), Failure> {
        self.create_fault(ctx, name)?;
        let f = regular(
            &self.dir,
            name,
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
        )?;
        ctx.event(self.scope, name, "created")?;
        self.write_file(ctx, f, bytes, name)
    }
    pub fn create_anchor(&self, ctx: &mut Context<P>, bytes: &[u8]) -> Result<(), Failure> {
        let fault = self.create_fault(ctx, "anchor.json");
        ctx.scoped(0, fault)?;
        let f = ctx.scoped(
            0,
            regular(
                &self.parent,
                &self.anchor_name,
                libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
            ),
        )?;
        ctx.event(self.scope, "anchor.json", "created")?;
        self.write_file(ctx, f, bytes, "anchor.json")?;
        self.sync(ctx, &self.parent, "anchor_parent")
    }
    pub fn replace<T: Serialize + Heap>(
        &self,
        ctx: &mut Context<P>,
        target: &'static str,
        temp: &'static str,
        value: &T,
        parent: bool,
    ) -> Result<(), Failure> {
        self.replace_bound(ctx, target, temp, value, parent, || Ok(()))
    }
    fn replace_bound<T: Serialize + Heap>(
        &self,
        ctx: &mut Context<P>,
        target: &'static str,
        temp: &'static str,
        value: &T,
        parent: bool,
        binding: impl FnOnce() -> Result<(), Failure>,
    ) -> Result<(), Failure> {
        let bytes = codec::emit(value, C).map_err(|_| Failure::damage())?;
        let dir = if parent { &self.parent } else { &self.dir };
        let namespace_scope = if parent { 0 } else { self.scope };
        let fault = self.create_fault(ctx, temp);
        ctx.scoped(namespace_scope, fault)?;
        binding()?;
        let f = ctx.scoped(
            namespace_scope,
            regular(dir, temp, libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL),
        )?;
        ctx.event(self.scope, temp, "created")?;
        self.write_file(ctx, f, &bytes, temp)?;
        if ctx.event(self.scope, temp, "before_rename")? == LedgerIoFault::Io {
            let n = Owned::new(CString::new(temp).unwrap());
            // SAFETY: invalid dirfds and valid basename cause EBADF, never mutation.
            if unsafe { libc::renameat(-1, n.as_ptr(), -1, n.as_ptr()) } != 0 {
                return ctx.scoped(namespace_scope, Err(Failure::io()));
            }
        }
        ctx.scoped(
            namespace_scope,
            rename(dir, temp, if parent { &self.anchor_name } else { target }),
        )?;
        ctx.event(self.scope, temp, "renamed")?;
        self.sync(ctx, dir, if parent { "anchor_parent" } else { "directory" })
    }
    pub fn append(&self, ctx: &mut Context<P>, bytes: &[u8]) -> Result<(), Failure> {
        self.write_file(
            ctx,
            regular(&self.dir, "trace.jsonl", libc::O_WRONLY | libc::O_APPEND)?,
            bytes,
            "trace.jsonl",
        )
    }
    pub fn cleanup(
        &self,
        ctx: &mut Context<P>,
        temp: &'static str,
        parent: bool,
    ) -> Result<(), Failure> {
        work::attempt(B::Cleanup, 0, 1);
        let dir = if parent { &self.parent } else { &self.dir };
        let namespace_scope = if parent { 0 } else { self.scope };
        let fault = ctx.event(self.scope, temp, "before_unlink")?;
        if fault == LedgerIoFault::Io {
            let n = Owned::new(CString::new(temp).unwrap());
            // SAFETY: invalid dirfd, trusted basename; unlink fails without namespace mutation.
            if unsafe { libc::unlinkat(-1, n.as_ptr(), 0) } != 0 {
                return ctx.scoped(namespace_scope, Err(Failure::io()));
            }
        }
        ctx.scoped(namespace_scope, unlink(dir, temp))?;
        ctx.event(self.scope, temp, "unlinked")?;
        self.sync(ctx, dir, if parent { "anchor_parent" } else { "directory" })?;
        work::complete(B::Cleanup, true);
        Ok(())
    }
    pub fn clear(&self) -> Incident {
        Incident {
            format: self
                .profile
                .tag(if self.scope == 0 {
                    "incident"
                } else {
                    "member-incident"
                })
                .into(),
            custody: self.custody.clone(),
            state: "clear".into(),
            phase: None,
            issue: None,
        }
    }
    pub fn incident(&self, ctx: &mut Context<P>) -> Result<(), Failure> {
        if !work::test(B::Fields, 0, 1, || !ctx.latched[self.scope as usize]) {
            return Err(Failure::damage());
        }
        let temporary = exists_at(&self.dir, "incident.tmp")?;
        if !work::test(B::Fields, 0, 1, || !temporary) {
            return Err(Failure::damage());
        }
        let i: Owned<Incident> = self.control(ctx, "incident.json")?;
        let clear = Owned::constructed(|| self.clear());
        if !work::test(
            B::Relationships,
            i.logical().max(clear.logical()),
            5,
            || *i == *clear,
        ) {
            return Err(Failure::damage());
        }
        Ok(())
    }
    pub fn retain_member(
        &self,
        ctx: &mut Context<P>,
        e: &Failure,
        shared: super::continuity::receipt::SharedGrounds<'_, P>,
    ) {
        self.retain_grounded(ctx, e, None, Some(shared))
    }
    pub fn retain_with_grants(
        &self,
        ctx: &mut Context<P>,
        e: &Failure,
        grants: Option<&[crate::LedgerPair; 16]>,
    ) {
        self.retain_grounded(ctx, e, grants, None)
    }
    fn retain_grounded(
        &self,
        ctx: &mut Context<P>,
        e: &Failure,
        grants: Option<&[crate::LedgerPair; 16]>,
        shared: Option<super::continuity::receipt::SharedGrounds<'_, P>>,
    ) {
        if !e.observed {
            return;
        }
        let _ground_charge = P::charge(std::mem::size_of::<
            super::continuity::receipt::SharedGrounds<'_, P>,
        >());
        ctx.latched[self.scope as usize] = true;
        work::attempt(B::Retention, 0, 1);
        if self.profile == super::selection::Profile::Continuity {
            let receipt = self.receipt.take();
            let allowed = (self.scope == 0 || shared.as_ref().is_some_and(|s| s.binding().is_ok()))
                && receipt.is_some_and(|r| r.grounds(self, ctx, grants).is_ok());
            if !allowed {
                work::complete(B::Retention, false);
                return;
            }
            self.receipt.set(receipt);
        } else if !self.justified.get() {
            work::complete(B::Retention, false);
            return;
        }
        let result = (|| {
            let temporary = exists_at(&self.dir, "incident.tmp")?;
            if !work::test(B::Fields, 0, 1, || !temporary) {
                return Err(Failure::damage());
            }
            let i: Owned<Incident> = self.control(ctx, "incident.json")?;
            let clear = Owned::constructed(|| self.clear());
            if !work::test(
                B::Relationships,
                i.logical().max(clear.logical()),
                5,
                || *i == *clear,
            ) {
                return Err(Failure::damage());
            }
            let blocked = Owned::constructed(|| Incident {
                state: "blocked".into(),
                phase: Some(ctx.phase.into()),
                issue: Some(e.issue.into()),
                format: clear.format.clone(),
                custody: clear.custody.clone(),
            });
            self.replace_bound(
                ctx,
                "incident.json",
                "incident.tmp",
                &*blocked,
                false,
                || {
                    if self.profile == super::selection::Profile::Continuity {
                        if let Some(shared) = &shared {
                            shared.binding()?;
                        }
                        self.receipt
                            .get()
                            .ok_or_else(Failure::damage)?
                            .binding(self)
                    } else {
                        Ok(())
                    }
                },
            )
        })();
        if result.is_err() && self.profile == super::selection::Profile::Continuity {
            self.receipt.set(None);
        }
        work::complete(B::Retention, result.is_ok());
    }
    pub fn physical(
        &self,
        proof: Option<&super::continuity::identity::Pair>,
    ) -> Result<super::codec::Physical<P>, Failure> {
        let legacy = if self.profile == super::selection::Profile::Continuity {
            super::codec::LegacyPhysical {
                directory_device: 0,
                directory_inode: 0,
                lock_device: 0,
                lock_inode: 0,
            }
        } else {
            let (directory_device, directory_inode) = raw::id(&self.dir)?;
            let (lock_device, lock_inode) = raw::id(&self.lock)?;
            super::codec::LegacyPhysical {
                directory_device,
                directory_inode,
                lock_device,
                lock_inode,
            }
        };
        P::physical(legacy, proof.copied()).map(super::codec::Physical)
    }
}
