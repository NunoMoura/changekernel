//! Linux v6.12, x86_64 LE LP64 held-fd btrfs identity. No handle reopening.
//! Only native acquisition lives here; encodings, hooks and counters belong to callers.
use super::custody_fs::Failure;
use std::{fs::File, os::fd::AsRawFd};

#[derive(Clone, Copy, Debug)]
pub(crate) struct Identity {
    pub fsid: [u8; 16],
    pub handle: [u8; 20],
}
#[repr(C)]
struct FsInfo {
    max_id: u64,
    num_devices: u64,
    fsid: [u8; 16],
    nodesize: u32,
    sectorsize: u32,
    clone_alignment: u32,
    csum_type: u16,
    csum_size: u16,
    flags: u64,
    generation: u64,
    metadata_uuid: [u8; 16],
    reserved: [u8; 944],
}
#[repr(C)]
struct Handle {
    bytes: u32,
    kind: i32,
    data: [u8; 128],
}
pub(crate) fn supported() -> bool {
    cfg!(all(
        target_os = "linux",
        target_arch = "x86_64",
        target_endian = "little",
        target_pointer_width = "64"
    ))
}
pub(crate) fn errno(n: i32) -> Failure {
    if matches!(n, libc::EIO | libc::EUCLEAN | libc::EREMOTEIO) {
        Failure::io()
    } else {
        Failure::damage()
    }
}

pub(crate) struct Acquisition {
    fs: libc::statfs,
    info: FsInfo,
    handle: Handle,
    mount: i32,
}
impl Acquisition {
    pub fn new() -> Result<Self, Failure> {
        if !supported() {
            return Err(Failure::damage());
        }
        Ok(Self {
            // SAFETY: native output buffers contain only integer fields.
            fs: unsafe { std::mem::zeroed() },
            info: unsafe { std::mem::zeroed() },
            handle: Handle {
                bytes: 128,
                kind: 0,
                data: [0; 128],
            },
            mount: 0,
        })
    }
    pub fn fs_type(&mut self, fd: &File) -> i32 {
        // SAFETY: live borrowed fd, initialized native output, one attempt.
        unsafe { libc::fstatfs(fd.as_raw_fd(), &mut self.fs) }
    }
    pub fn fs_info(&mut self, fd: &File) -> i32 {
        // SAFETY: the supported ABI/UAPI guard ran in new; buffer is 1024 bytes.
        unsafe { libc::ioctl(fd.as_raw_fd(), 0x8400941f as libc::c_ulong, &mut self.info) }
    }
    pub fn file_handle(&mut self, fd: &File) -> i32 {
        // SAFETY: held descriptor, empty path and initialized bounded buffers.
        // This acquires raw bytes only; it never opens a file by handle.
        unsafe {
            libc::syscall(
                libc::SYS_name_to_handle_at,
                fd.as_raw_fd(),
                c"".as_ptr(),
                &mut self.handle,
                &mut self.mount,
                libc::AT_EMPTY_PATH,
            ) as i32
        }
    }
    pub fn valid_fs_type(&self) -> bool {
        self.fs.f_type == 0x9123683e
    }
    pub fn valid_fsid(&self) -> bool {
        self.info.fsid.iter().any(|b| *b != 0)
    }
    pub fn valid_handle_shape(&self) -> bool {
        self.handle.bytes == 20 && self.handle.kind == 77
    }
    pub fn valid_handle_data(&self) -> bool {
        self.handle.data[..20].iter().any(|b| *b != 0)
    }
    // The current caller already checked filesystem type and FSID at their
    // native cuts. Validate only the newly acquired handle here.
    fn finish_handle(&self) -> Result<Identity, Failure> {
        if !self.valid_handle_shape() || !self.valid_handle_data() {
            return Err(Failure::damage());
        }
        Ok(self.copy_identity_after_validation())
    }
    // The caller has validated all four groups before copying.
    pub fn copy_identity_after_validation(&self) -> Identity {
        let mut handle = [0; 20];
        handle.copy_from_slice(&self.handle.data[..20]);
        Identity {
            fsid: self.info.fsid,
            handle,
        }
    }
}
fn completed(rc: i32) -> Result<(), Failure> {
    if rc == 0 {
        Ok(())
    } else {
        Err(errno(
            std::io::Error::last_os_error()
                .raw_os_error()
                .unwrap_or(libc::EINVAL),
        ))
    }
}
pub(crate) fn held_identity(file: &File) -> Result<Identity, Failure> {
    // Retain the existing independently owned descriptor lifetime/failure boundary.
    let fd = file.try_clone().map_err(|_| Failure::io())?;
    let mut a = Acquisition::new()?;
    completed(a.fs_type(&fd))?;
    if !a.valid_fs_type() {
        return Err(Failure::damage());
    }
    completed(a.fs_info(&fd))?;
    if !a.valid_fsid() {
        return Err(Failure::damage());
    }
    completed(a.file_handle(&fd))?;
    a.finish_handle()
}
const _: () = assert!(
    std::mem::size_of::<FsInfo>() == 1024
        && std::mem::size_of::<Handle>() == 136
        && std::mem::size_of::<Identity>() == 36
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_refusals_are_not_observed_io_failures() {
        for n in [libc::EIO, libc::EUCLEAN, libc::EREMOTEIO] {
            let failure = errno(n);
            assert!(failure.observed);
            assert_eq!(failure.issue, "io");
        }
        for n in [
            libc::EPERM,
            libc::EINVAL,
            libc::EOPNOTSUPP,
            libc::EOVERFLOW,
            libc::EBADF,
        ] {
            let failure = errno(n);
            assert!(!failure.observed);
            assert_eq!(failure.issue, "inconsistent");
        }
    }

    #[test]
    fn staged_identity_checks_require_exact_shape_and_nonzero_raw_fields() {
        if !supported() {
            assert!(Acquisition::new().is_err());
            return;
        }
        fn valid() -> Acquisition {
            let mut a = Acquisition::new().unwrap();
            a.fs.f_type = 0x9123683e;
            a.info.fsid[15] = 1;
            a.handle.bytes = 20;
            a.handle.kind = 77;
            a.handle.data[19] = 2;
            a
        }
        let a = valid();
        assert!(a.valid_fs_type());
        assert!(a.valid_fsid());
        let id = a.finish_handle().unwrap();
        assert_eq!(id.fsid[15], 1);
        assert_eq!(id.handle[19], 2);
        let mut wrong_fs = valid();
        wrong_fs.fs.f_type = 0;
        assert!(!wrong_fs.valid_fs_type());
        let mut zero_fsid = valid();
        zero_fsid.info.fsid = [0; 16];
        assert!(!zero_fsid.valid_fsid());
        for case in 0..4 {
            let mut a = valid();
            match case {
                0 => a.handle.bytes = 19,
                1 => a.handle.bytes = 21,
                2 => a.handle.kind = 78,
                3 => {
                    a.handle.data[19] = 0;
                    a.handle.data[20] = 2; // bytes beyond the declared handle do not count
                }
                _ => unreachable!(),
            }
            let failure = a.finish_handle().unwrap_err();
            assert!(!failure.observed);
            assert_eq!(failure.issue, "inconsistent");
        }
    }
}
