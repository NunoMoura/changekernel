//! Logical I/O boundaries and source-test fault hooks, never a bridge option.
use super::{raw, Error, Result};
use std::{
    cell::{Cell, RefCell},
    fs::File,
    io::{Read, Write},
    os::unix::fs::MetadataExt,
};
#[derive(Clone, Debug)]
pub struct ReferencedIntentIoEvent {
    pub phase: &'static str,
    pub object: String,
    pub step: &'static str,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReferencedIntentIoFault {
    Continue,
    Io,
    ShortWrite,
}
pub type ReferencedIntentIoHook =
    Box<dyn FnMut(ReferencedIntentIoEvent) -> ReferencedIntentIoFault>;
pub(super) struct Io {
    pub phase: Cell<&'static str>,
    pub observed: Cell<bool>,
    pub issue: Cell<&'static str>,
    hook: RefCell<Option<ReferencedIntentIoHook>>,
}
impl Io {
    pub fn new(hook: Option<ReferencedIntentIoHook>) -> Self {
        Self {
            phase: Cell::new("provision"),
            observed: Cell::new(false),
            issue: Cell::new("io"),
            hook: RefCell::new(hook),
        }
    }
    pub fn fail(&self, issue: &'static str) -> Error {
        self.observed.set(true);
        self.issue.set(issue);
        Error::Unavailable
    }
    pub fn raw<T>(&self, r: std::result::Result<T, raw::Failure>) -> Result<T> {
        r.map_err(|e| {
            if e.observed {
                self.fail(e.issue)
            } else {
                Error::Unavailable
            }
        })
    }
    pub fn syscall<T>(&self, r: std::io::Result<T>) -> Result<T> {
        r.map_err(|_| self.fail("io"))
    }
    pub fn event(&self, name: &str, step: &'static str) -> Result<ReferencedIntentIoFault> {
        let fault =
            self.hook
                .borrow_mut()
                .as_mut()
                .map_or(ReferencedIntentIoFault::Continue, |h| {
                    h(ReferencedIntentIoEvent {
                        phase: self.phase.get(),
                        object: name.into(),
                        step,
                    })
                });
        match fault {
            ReferencedIntentIoFault::Io => Err(self.fail(if step == "before_sync" {
                "barrier"
            } else {
                "io"
            })),
            ReferencedIntentIoFault::ShortWrite if step != "before_write" => {
                Err(Error::Unavailable)
            }
            v => Ok(v),
        }
    }
    pub fn sync(&self, f: &File, name: &str) -> Result<()> {
        self.event(name, "before_sync")?;
        f.sync_all().map_err(|_| self.fail("barrier"))?;
        self.event(name, "synced")?;
        Ok(())
    }
    pub fn exists(&self, dir: &File, name: &str) -> Result<bool> {
        self.raw(raw::exists_at(dir, name))
    }
    pub fn regular(&self, dir: &File, name: &str, flags: i32) -> Result<File> {
        let f = self.raw(raw::at(dir, name.as_bytes(), flags, 0o600))?;
        let m = self.syscall(f.metadata())?;
        if !m.is_file() || m.nlink() != 1 {
            return Err(Error::Unavailable);
        }
        Ok(f)
    }
    pub fn read(&self, dir: &File, name: &str, limit: usize) -> Result<Vec<u8>> {
        self.event(name, "before_read")?;
        let f = self.regular(dir, name, libc::O_RDONLY)?;
        let n = self.syscall(f.metadata())?.len();
        if n > limit as u64 {
            return Err(Error::Unavailable);
        }
        let mut b = Vec::with_capacity(n as usize);
        self.syscall((&f).take(limit as u64 + 1).read_to_end(&mut b))?;
        if b.len() > limit {
            return Err(Error::Unavailable);
        }
        self.event(name, "read")?;
        self.sync(&f, name)?;
        Ok(b)
    }
    pub fn write(&self, f: &mut File, name: &str, b: &[u8]) -> Result<()> {
        let short = self.event(name, "before_write")? == ReferencedIntentIoFault::ShortWrite;
        let bytes = if short { &b[..b.len() / 2] } else { b };
        let n = self.syscall(f.write(bytes))?;
        if short || n != b.len() {
            self.event(name, "short_written")?;
            return Err(self.fail("short_write"));
        }
        self.event(name, "written")?;
        Ok(())
    }
    pub fn create(&self, dir: &File, name: &str, b: &[u8]) -> Result<()> {
        self.event(name, "before_create")?;
        let mut f = self.regular(dir, name, libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL)?;
        self.event(name, "created")?;
        self.write(&mut f, name, b)?;
        self.sync(&f, name)
    }
    pub fn rename(&self, dir: &File, from: &str, to: &str) -> Result<()> {
        self.event(from, "before_rename")?;
        self.raw(raw::rename(dir, from, to))?;
        self.event(from, "renamed")?;
        Ok(())
    }
    pub fn replace(&self, dir: &File, target: &str, temp: &str, b: &[u8]) -> Result<()> {
        self.create(dir, temp, b)?;
        self.rename(dir, temp, target)?;
        self.sync(dir, "replacement_parent")?;
        self.event(temp, "parent_synced")?;
        Ok(())
    }
    pub fn remove(&self, dir: &File, name: &str) -> Result<()> {
        self.event(name, "before_unlink")?;
        self.raw(raw::unlink(dir, name))?;
        self.event(name, "unlinked")?;
        self.sync(dir, "cleanup_parent")?;
        self.event(name, "cleanup_synced")?;
        Ok(())
    }
}
