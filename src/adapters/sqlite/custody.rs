use super::store_error::{StoreError, StoreResult};
use std::fs::File;
use std::path::{Path, PathBuf};

/// Exact local objects, not an owner credential or a transferable writer capability.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CustodyBinding {
    pub directory_device: u64,
    pub directory_inode: u64,
    pub database_device: u64,
    pub database_inode: u64,
    pub lock_device: u64,
    pub lock_inode: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SidecarIdentity {
    device: u64,
    inode: u64,
}

// Only a completed connection close permits sidecar identities to be released. A
// checkpoint, rewind or truncate never starts a new connection lifetime.
enum ConnectionPhase {
    Disconnected,
    Connecting([Option<SidecarIdentity>; 2]),
    Live([SidecarIdentity; 2]),
}

/// An exclusive lifetime OS lock, separate from SQLite transactions. Opening never
/// creates missing files, loosens modes, repairs state or authorizes a Ledger operation.
pub struct WriterCustody {
    directory: PathBuf,
    directory_file: File,
    database_file: File,
    lock_file: File,
    binding: CustodyBinding,
    connection_phase: ConnectionPhase,
}
impl WriterCustody {
    pub fn create(directory: &Path) -> StoreResult<Self> {
        platform::acquire(directory, true)
    }
    pub fn open(directory: &Path) -> StoreResult<Self> {
        platform::acquire(directory, false)
    }
    pub fn verify_profile(directory: &Path) -> StoreResult<()> {
        platform::verify_profile(directory)
    }
    pub fn database_path(&self) -> PathBuf {
        self.directory.join("ledger.sqlite")
    }
    pub fn binding(&self) -> CustodyBinding {
        self.binding.clone()
    }
    pub(super) fn directory(&self) -> &Path {
        &self.directory
    }
    pub(super) fn sync_directory(&self) -> StoreResult<()> {
        self.check()?;
        self.directory_file.sync_all()?;
        self.check()
    }
    /// Never open application descriptors to SHM, or extra DB/WAL descriptors while live.
    pub(super) fn member(&self, name: &str, create: bool) -> StoreResult<File> {
        if name.is_empty()
            || Path::new(name).components().count() != 1
            || !matches!(
                Path::new(name).components().next(),
                Some(std::path::Component::Normal(_))
            )
            || name.ends_with("-shm")
            || ((name == "ledger.sqlite" || name == "ledger.sqlite-wal")
                && !matches!(self.connection_phase, ConnectionPhase::Disconnected))
        {
            return Err(StoreError::Custody);
        }
        self.check()?;
        platform::member(self, name, create)
    }
    pub(super) fn file_object(&self, file: &File) -> StoreResult<(u64, u64)> {
        platform::file_object(file)
    }
    pub(super) fn member_object(&self, name: &str) -> StoreResult<Option<(u64, u64)>> {
        platform::member_object(self, name)
    }
    pub(super) fn journal_objects(&self) -> StoreResult<[Option<(u64, u64)>; 2]> {
        Ok(platform::sidecars(self)?.map(|v| v.map(|s| (s.device, s.inode))))
    }
    pub fn check(&self) -> StoreResult<()> {
        platform::check(self)
    }
    pub(super) fn begin_connection(&mut self) -> StoreResult<()> {
        if !matches!(self.connection_phase, ConnectionPhase::Disconnected) {
            return Err(StoreError::Custody);
        }
        self.check()?;
        self.connection_phase = ConnectionPhase::Connecting(platform::sidecars(self)?);
        Ok(())
    }
    pub(super) fn connection_opened(&mut self) -> StoreResult<()> {
        if !matches!(self.connection_phase, ConnectionPhase::Connecting(_)) {
            return Err(StoreError::Custody);
        }
        self.check()?;
        let [Some(wal), Some(shm)] = platform::sidecars(self)? else {
            return Err(StoreError::Custody);
        };
        self.connection_phase = ConnectionPhase::Live([wal, shm]);
        self.check()
    }
    // Called only AFTER the owned SQLite connection successfully closes. It is never
    // a checkpoint/reset/fence bypass while that connection is still alive.
    pub(super) fn connection_closed(&mut self) -> StoreResult<()> {
        if !matches!(self.connection_phase, ConnectionPhase::Live(_)) {
            return Err(StoreError::Custody);
        }
        self.connection_phase = ConnectionPhase::Disconnected;
        self.check()
    }
    fn check_sidecars(&self, current: [Option<SidecarIdentity>; 2]) -> StoreResult<()> {
        let valid = match &self.connection_phase {
            ConnectionPhase::Disconnected => true,
            ConnectionPhase::Connecting(before) => before
                .iter()
                .zip(&current)
                .all(|(old, now)| old.is_none() || old == now),
            ConnectionPhase::Live(before) => before
                .iter()
                .zip(&current)
                .all(|(old, now)| Some(old) == now.as_ref()),
        };
        if valid {
            Ok(())
        } else {
            Err(StoreError::Custody)
        }
    }
    /// Sync the retained database inode and its directory, not a pathname replacement.
    pub fn sync(&self) -> StoreResult<()> {
        self.check()?;
        self.database_file.sync_all()?;
        self.directory_file.sync_all()?;
        self.check()
    }
}

#[cfg(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu"))]
mod platform {
    use super::*;
    use std::ffi::{c_int, c_long};
    use std::fs::{self, DirBuilder, Metadata, OpenOptions, TryLockError};
    use std::io;
    use std::os::fd::AsRawFd;
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt};
    const NOFOLLOW: c_int = 0x20000;
    const BTRFS_MAGIC: c_long = 0x9123683e;

    // Exact Linux x86_64 glibc ABI. Other ABIs explicitly refuse below rather than
    // guessing a layout. This does not limit portable kernel IDs/records.
    #[repr(C)]
    struct StatFs {
        kind: c_long,
        block_size: c_long,
        blocks: u64,
        free_blocks: u64,
        available_blocks: u64,
        files: u64,
        free_files: u64,
        fsid: [c_int; 2],
        name_length: c_long,
        fragment_size: c_long,
        flags: c_long,
        spare: [c_long; 4],
    }
    unsafe extern "C" {
        fn fstatfs(fd: c_int, out: *mut StatFs) -> c_int;
        fn geteuid() -> u32;
    }
    fn uid() -> u32 {
        // SAFETY: no-argument read-only local OS identity accessor.
        unsafe { geteuid() }
    }
    fn profile(file: &File) -> StoreResult<()> {
        let mut output = std::mem::MaybeUninit::<StatFs>::zeroed();
        // SAFETY: fd is a live retained file; output matches the selected ABI and is writable.
        if unsafe { fstatfs(file.as_raw_fd(), output.as_mut_ptr()) } != 0 {
            return Err(io::Error::last_os_error().into());
        }
        // SAFETY: every field is integer-valued and already initialized to zero;
        // fstatfs filled the selected ABI's fields. No spare-field initialization is assumed.
        let output = unsafe { output.assume_init() };
        if output.kind != BTRFS_MAGIC || output.flags & 1 != 0 {
            return Err(StoreError::UnsupportedProfile);
        }
        Ok(())
    }
    fn same(a: &Metadata, b: &Metadata) -> bool {
        a.dev() == b.dev() && a.ino() == b.ino()
    }
    fn private(metadata: &Metadata, directory: bool) -> StoreResult<()> {
        if metadata.uid() != uid()
            || metadata.mode() & 0o7777 != if directory { 0o700 } else { 0o600 }
            || (directory && !metadata.is_dir())
            || (!directory && (!metadata.is_file() || metadata.nlink() != 1))
        {
            return Err(StoreError::Custody);
        }
        Ok(())
    }
    fn path_identity(path: &Path) -> StoreResult<()> {
        if !path.is_absolute() || path.canonicalize()? != path {
            return Err(StoreError::Custody);
        }
        for parent in path.ancestors().skip(1) {
            let metadata = fs::symlink_metadata(parent)?;
            if !metadata.is_dir()
                || (metadata.uid() != uid() && metadata.uid() != 0)
                || metadata.mode() & 0o022 != 0
            {
                return Err(StoreError::Custody);
            }
        }
        Ok(())
    }
    fn open_file(path: &Path, create: bool) -> StoreResult<File> {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(create)
            .mode(0o600)
            .custom_flags(NOFOLLOW)
            .open(path)?;
        private(&file.metadata()?, false)?;
        if !same(&file.metadata()?, &fs::symlink_metadata(path)?) {
            return Err(StoreError::Custody);
        }
        Ok(file)
    }
    pub(super) fn member(lease: &WriterCustody, name: &str, create: bool) -> StoreResult<File> {
        let file = open_file(&lease.directory.join(name), create)?;
        profile(&file)?;
        Ok(file)
    }
    pub(super) fn file_object(file: &File) -> StoreResult<(u64, u64)> {
        let metadata = file.metadata()?;
        private(&metadata, false)?;
        Ok((metadata.dev(), metadata.ino()))
    }
    pub(super) fn member_object(
        lease: &WriterCustody,
        name: &str,
    ) -> StoreResult<Option<(u64, u64)>> {
        match fs::symlink_metadata(lease.directory.join(name)) {
            Ok(m) => {
                private(&m, false)?;
                Ok(Some((m.dev(), m.ino())))
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
    pub(super) fn verify_profile(directory: &Path) -> StoreResult<()> {
        profile(&File::open(directory)?)
    }
    pub(super) fn acquire(directory: &Path, create: bool) -> StoreResult<WriterCustody> {
        if create {
            // Refuse unsupported parent storage before creating any files.
            let parent = directory.parent().ok_or(StoreError::Custody)?;
            profile(&File::open(parent)?)?;
            if !directory.is_absolute() || parent.canonicalize()? != parent {
                return Err(StoreError::Custody);
            }
            DirBuilder::new().mode(0o700).create(directory)?;
        }
        path_identity(directory)?;
        let directory_file = OpenOptions::new()
            .read(true)
            .custom_flags(NOFOLLOW)
            .open(directory)?;
        private(&directory_file.metadata()?, true)?;
        profile(&directory_file)?;
        let lock_file = open_file(&directory.join("writer.lock"), create)?;
        match lock_file.try_lock() {
            Ok(()) => {}
            Err(TryLockError::WouldBlock) => return Err(StoreError::Busy),
            Err(TryLockError::Error(error)) => return Err(error.into()),
        }
        let database_file = open_file(&directory.join("ledger.sqlite"), create)?;
        let (dir, database, lock) = (
            directory_file.metadata()?,
            database_file.metadata()?,
            lock_file.metadata()?,
        );
        let lease = WriterCustody {
            directory: directory.to_owned(),
            directory_file,
            database_file,
            lock_file,
            connection_phase: ConnectionPhase::Disconnected,
            binding: CustodyBinding {
                directory_device: dir.dev(),
                directory_inode: dir.ino(),
                database_device: database.dev(),
                database_inode: database.ino(),
                lock_device: lock.dev(),
                lock_inode: lock.ino(),
            },
        };
        lease.check()?;
        if create {
            lease.lock_file.sync_all()?;
            lease.sync()?;
            File::open(directory.parent().ok_or(StoreError::Custody)?)?.sync_all()?;
        }
        Ok(lease)
    }
    pub(super) fn sidecars(lease: &WriterCustody) -> StoreResult<[Option<SidecarIdentity>; 2]> {
        let mut out = [None; 2];
        for (slot, suffix) in out.iter_mut().zip(["-wal", "-shm"]) {
            match fs::symlink_metadata(lease.directory.join(format!("ledger.sqlite{suffix}"))) {
                Ok(metadata) => {
                    private(&metadata, false)?;
                    *slot = Some(SidecarIdentity {
                        device: metadata.dev(),
                        inode: metadata.ino(),
                    });
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                Err(error) => return Err(error.into()),
            }
        }
        Ok(out)
    }
    pub(super) fn check(lease: &WriterCustody) -> StoreResult<()> {
        path_identity(&lease.directory)?;
        for (path, file, directory) in [
            (lease.directory.clone(), &lease.directory_file, true),
            (lease.database_path(), &lease.database_file, false),
            (lease.directory.join("writer.lock"), &lease.lock_file, false),
        ] {
            let current = fs::symlink_metadata(path)?;
            let retained = file.metadata()?;
            private(&current, directory)?;
            private(&retained, directory)?;
            if !same(&current, &retained) {
                return Err(StoreError::Custody);
            }
        }
        // Contents may change, but live WAL/wal-index path identities may not. Record
        // metadata, not extra open shm descriptors: closing those could disturb SQLite's
        // process-scoped POSIX locks. SQLite keeps the live inodes open/mapped itself.
        lease.check_sidecars(sidecars(lease)?)?;
        match fs::symlink_metadata(lease.directory.join("ledger.sqlite-journal")) {
            Ok(_) => return Err(StoreError::UnsupportedProfile),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        profile(&lease.directory_file)
    }
}
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
mod platform {
    use super::*;
    pub(super) fn acquire(_: &Path, _: bool) -> StoreResult<WriterCustody> {
        Err(StoreError::UnsupportedProfile)
    }
    pub(super) fn verify_profile(_: &Path) -> StoreResult<()> {
        Err(StoreError::UnsupportedProfile)
    }
    pub(super) fn check(_: &WriterCustody) -> StoreResult<()> {
        Err(StoreError::UnsupportedProfile)
    }
    pub(super) fn sidecars(_: &WriterCustody) -> StoreResult<[Option<SidecarIdentity>; 2]> {
        Err(StoreError::UnsupportedProfile)
    }
    pub(super) fn member(_: &WriterCustody, _: &str, _: bool) -> StoreResult<File> {
        Err(StoreError::UnsupportedProfile)
    }
    pub(super) fn file_object(_: &File) -> StoreResult<(u64, u64)> {
        Err(StoreError::UnsupportedProfile)
    }
    pub(super) fn member_object(_: &WriterCustody, _: &str) -> StoreResult<Option<(u64, u64)>> {
        Err(StoreError::UnsupportedProfile)
    }
}
