//! Private no-follow, descriptor-relative filesystem primitives.
//! Optional callbacks preserve existing callers' resource/field observations;
//! this module owns no semantic profile or counter.
use std::{
    ffi::CString,
    fs::File,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::ffi::OsStrExt,
    },
    path::{Component, Path},
};

#[derive(Debug)]
pub(crate) struct Failure {
    pub(crate) issue: &'static str,
    pub(crate) observed: bool,
}
impl Failure {
    pub fn damage() -> Self {
        Self {
            issue: "inconsistent",
            observed: false,
        }
    }
    pub(crate) fn io() -> Self {
        Self {
            issue: "io",
            observed: true,
        }
    }
    pub(crate) fn barrier() -> Self {
        Self {
            issue: "barrier",
            observed: true,
        }
    }
    pub(crate) fn short() -> Self {
        Self {
            issue: "short_write",
            observed: true,
        }
    }
}
// O_NOFOLLOW at every component; owning descriptors are close-on-exec.
pub(crate) fn directory(path: &Path) -> Result<File, Failure> {
    directory_fields(path, None, None, PrimitiveFields::default())
}
pub(crate) fn at(dir: &File, name: &[u8], flags: i32, mode: u32) -> Result<File, Failure> {
    at_fields(
        dir,
        name,
        flags,
        mode,
        None,
        None,
        PrimitiveFields::default(),
    )
}
struct FdObservation<'a> {
    observe: Option<&'a dyn Fn(bool)>,
    armed: bool,
}
impl Drop for FdObservation<'_> {
    fn drop(&mut self) {
        if self.armed {
            if let Some(o) = self.observe {
                o(false);
            }
        }
    }
}
pub(crate) type FieldRanges<'a> = &'a dyn Fn(usize, usize, Option<bool>);
#[derive(Clone, Copy, Default)]
pub(crate) struct PrimitiveFields<'a> {
    pub checks: Option<&'a dyn Fn(usize, Option<bool>)>,
    pub legacy: Option<&'a dyn Fn(Option<bool>)>,
    pub ranges: Option<FieldRanges<'a>>,
}
impl PrimitiveFields<'_> {
    fn check(self, bytes: usize, result: Option<bool>) {
        if let Some(o) = self.checks {
            o(bytes, result);
        }
    }

    fn reached(self, bytes: usize, words: usize, result: Option<bool>) {
        if let Some(o) = self.legacy {
            o(result);
        }
        self.range(bytes, words, result);
    }
    fn range(self, bytes: usize, words: usize, result: Option<bool>) {
        if let Some(o) = self.ranges {
            o(bytes, words, result);
        }
    }
}
pub(crate) fn directory_fields(
    path: &Path,
    observe: Option<&dyn Fn(bool)>,
    capacity: Option<&dyn Fn(usize)>,
    fields: PrimitiveFields<'_>,
) -> Result<File, Failure> {
    fields.check(0, None);
    fields.reached(path.as_os_str().len(), 4, None);
    let invalid = !path.is_absolute()
        || path.as_os_str().len() > 4096
        || path
            .to_str()
            .is_none_or(|s| s.chars().any(char::is_control));
    fields.check(0, Some(!invalid));
    fields.reached(path.as_os_str().len(), 4, Some(!invalid));
    if invalid {
        return Err(Failure::damage());
    }
    let mut dir = File::open("/").map_err(|_| Failure::io())?;
    if let Some(o) = observe {
        o(true);
    }
    let mut guard = FdObservation {
        observe,
        armed: true,
    };
    // Metadata for the spelling group comes from the existing traversal, not
    // a second scan. Dot-normalization contributes only the fixed literals.
    let mut segment_bytes = 0;
    fields.range(0, 5, None);
    for component in path.components() {
        match component {
            Component::RootDir => (),
            Component::Normal(name) => {
                segment_bytes = segment_bytes.max(name.len());
                dir = at_fields(
                    &dir,
                    name.as_bytes(),
                    libc::O_RDONLY | libc::O_DIRECTORY,
                    0,
                    observe,
                    capacity,
                    fields,
                )?;
                if let Some(o) = observe {
                    o(false);
                }
            }
            _ => {
                fields.range(0, 5, Some(false));
                return Err(Failure::damage());
            }
        }
    }
    fields.range(0, 5, Some(true));
    // components() normalizes embedded '.', so reject original spelling too.
    fields.check(3, None);
    fields.reached(segment_bytes.max(b"..".len()), 3, None);
    let unnormalized = path
        .as_os_str()
        .as_bytes()
        .split(|b| *b == b'/')
        .any(|s| s == b"." || s == b"..");
    fields.check(3, Some(!unnormalized));
    fields.reached(segment_bytes.max(b"..".len()), 3, Some(!unnormalized));
    if unnormalized {
        return Err(Failure::damage());
    }
    guard.armed = false;
    Ok(dir)
}
pub(crate) fn at_fields(
    dir: &File,
    name: &[u8],
    flags: i32,
    mode: u32,
    observe: Option<&dyn Fn(bool)>,
    capacity: Option<&dyn Fn(usize)>,
    fields: PrimitiveFields<'_>,
) -> Result<File, Failure> {
    fields.range(name.len().max(1), 1, None);
    let candidate = CString::new(name);
    fields.range(name.len().max(1), 1, Some(candidate.is_ok()));
    let name = candidate.map_err(|_| Failure::damage())?;
    // CString owns an exact boxed slice, including its trailing NUL.
    if let Some(o) = capacity {
        o(name.to_bytes_with_nul().len());
    }
    struct Name<'a>(Option<&'a dyn Fn(usize)>);
    impl Drop for Name<'_> {
        fn drop(&mut self) {
            if let Some(o) = self.0 {
                o(0);
            }
        }
    }
    let _name = Name(capacity);
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
    if let Some(o) = observe {
        o(true);
    }
    let mut guard = FdObservation {
        observe,
        armed: true,
    };
    if flags & libc::O_DIRECTORY == 0 {
        fields.check(0, None);
        fields.reached(0, 1, None);
        let regular = f.metadata().map_err(|_| Failure::io())?.is_file();
        fields.check(0, Some(regular));
        fields.reached(0, 1, Some(regular));
        if !regular {
            return Err(Failure::damage());
        }
    }
    guard.armed = false;
    Ok(f)
}
pub(crate) fn exists_at(dir: &File, name: &str) -> Result<bool, Failure> {
    exists_at_capacity(dir, name, None)
}
struct Names<'a>(Option<&'a dyn Fn(usize)>);
impl Drop for Names<'_> {
    fn drop(&mut self) {
        if let Some(o) = self.0 {
            o(0);
        }
    }
}
pub(crate) fn exists_at_capacity(
    dir: &File,
    name: &str,
    capacity: Option<&dyn Fn(usize)>,
) -> Result<bool, Failure> {
    let name = CString::new(name).map_err(|_| Failure::damage())?;
    let _names = Names(capacity);
    if let Some(o) = capacity {
        o(name.as_bytes_with_nul().len());
    }
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
pub(crate) fn unlink(dir: &File, name: &str) -> Result<(), Failure> {
    unlink_capacity(dir, name, None)
}
pub(crate) fn unlink_capacity(
    dir: &File,
    name: &str,
    capacity: Option<&dyn Fn(usize)>,
) -> Result<(), Failure> {
    let name = CString::new(name).map_err(|_| Failure::damage())?;
    let _names = Names(capacity);
    if let Some(o) = capacity {
        o(name.as_bytes_with_nul().len());
    }
    // SAFETY: directory and filename valid; no recursive or path-selected deletion.
    if unsafe { libc::unlinkat(dir.as_raw_fd(), name.as_ptr(), 0) } != 0 {
        return Err(Failure::io());
    }
    Ok(())
}
pub(crate) fn rename(dir: &File, from: &str, to: &str) -> Result<(), Failure> {
    rename_capacity(dir, from, to, None)
}
pub(crate) fn rename_capacity(
    dir: &File,
    from: &str,
    to: &str,
    capacity: Option<&dyn Fn(usize)>,
) -> Result<(), Failure> {
    let from = CString::new(from).map_err(|_| Failure::damage())?;
    let _names = Names(capacity);
    if let Some(o) = capacity {
        o(from.as_bytes_with_nul().len());
    }
    let to = CString::new(to).map_err(|_| Failure::damage())?;
    if let Some(o) = capacity {
        o(from.as_bytes_with_nul().len() + to.as_bytes_with_nul().len());
    }
    // SAFETY: same pinned parent, valid fds and filenames.
    if unsafe { libc::renameat(dir.as_raw_fd(), from.as_ptr(), dir.as_raw_fd(), to.as_ptr()) } != 0
    {
        return Err(Failure::io());
    }
    Ok(())
}
