//! Private no-follow, descriptor-relative filesystem primitives.
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
}
// O_NOFOLLOW at every component; owning descriptors are close-on-exec.
pub(crate) fn directory(path: &Path) -> Result<File, Failure> {
    let invalid = !path.is_absolute()
        || path.as_os_str().len() > 4096
        || path
            .to_str()
            .is_none_or(|s| s.chars().any(char::is_control));
    if invalid {
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
    let unnormalized = path
        .as_os_str()
        .as_bytes()
        .split(|b| *b == b'/')
        .any(|s| s == b"." || s == b"..");
    if unnormalized {
        return Err(Failure::damage());
    }
    Ok(dir)
}
pub(crate) fn at(dir: &File, name: &[u8], flags: i32, mode: u32) -> Result<File, Failure> {
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
    if flags & libc::O_DIRECTORY == 0 {
        let regular = f.metadata().map_err(|_| Failure::io())?.is_file();
        if !regular {
            return Err(Failure::damage());
        }
    }
    Ok(f)
}
pub(crate) fn exists_at(dir: &File, name: &str) -> Result<bool, Failure> {
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
pub(crate) fn unlink(dir: &File, name: &str) -> Result<(), Failure> {
    let name = CString::new(name).map_err(|_| Failure::damage())?;
    // SAFETY: directory and filename valid; no recursive or path-selected deletion.
    if unsafe { libc::unlinkat(dir.as_raw_fd(), name.as_ptr(), 0) } != 0 {
        return Err(Failure::io());
    }
    Ok(())
}
pub(crate) fn rename(dir: &File, from: &str, to: &str) -> Result<(), Failure> {
    let from = CString::new(from).map_err(|_| Failure::damage())?;
    let to = CString::new(to).map_err(|_| Failure::damage())?;
    // SAFETY: same pinned parent, valid fds and filenames.
    if unsafe { libc::renameat(dir.as_raw_fd(), from.as_ptr(), dir.as_raw_fd(), to.as_ptr()) } != 0
    {
        return Err(Failure::io());
    }
    Ok(())
}
