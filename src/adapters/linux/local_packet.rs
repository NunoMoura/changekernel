//! Linux byte-and-peer boundary for the future protected local control plane.
//!
//! Packet credentials do not establish durable enrollment, source permissions,
//! domain acceptance or service qualification. The trusted host owns those guards.

use std::io;
use std::mem::{self, size_of};
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd};
use std::os::unix::ffi::OsStrExt;
use std::path::Path;
use std::time::{Duration, Instant};

/// Maximum bytes in one request or reply packet; packets are never reassembled.
pub const MAX_PACKET_BYTES: usize = 196_608;

/// Kernel-observed peer data, not a transferable authorization token.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PeerCredentials {
    pub pid: i32,
    pub uid: u32,
    pub gid: u32,
}

/// Transport outcomes, separate from domain results encoded by the dispatcher.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PacketIssue {
    Denied,
    InvalidInput,
    Unavailable,
}

const BUDGET: Duration = Duration::from_secs(5);
// Linux SCM_PIDFD, including on libc versions predating the named constant.
const SCM_PIDFD: libc::c_int = 4;

/// Consume at most one connection and packet from a host-configured listener.
/// The listener is borrowed; the accepted connection closes on every exit.
pub fn serve_one<F>(listener: &OwnedFd, expected_uid: u32, handler: F) -> Result<(), PacketIssue>
where
    F: FnOnce(PeerCredentials, Vec<u8>) -> Result<Vec<u8>, PacketIssue>,
{
    let deadline = Instant::now() + BUDGET;
    validate_listener(listener.as_raw_fd())?;
    let connection = accept(listener.as_raw_fd(), deadline)?;
    let fd = connection.as_raw_fd();
    prepare_buffer(fd)?;
    let peer = peer_credentials(fd, expected_uid)?;
    let packet = receive(fd, peer, deadline)?;
    let reply = handler(peer, packet)?;
    send(fd, &reply, Instant::now() + BUDGET)
}

/// Exchange one opaque packet with one explicitly addressed local service.
/// Never retries an operation or interprets domain outcomes.
pub fn request(
    endpoint: &Path,
    expected_service_uid: u32,
    payload: &[u8],
) -> Result<Vec<u8>, PacketIssue> {
    check_size(payload)?;
    let (address, length) = address(endpoint)?;
    let deadline = Instant::now() + BUDGET;
    // SAFETY: socket has no pointer arguments; successful result is newly owned.
    let fd = unsafe {
        libc::socket(
            libc::AF_UNIX,
            libc::SOCK_SEQPACKET | libc::SOCK_NONBLOCK | libc::SOCK_CLOEXEC,
            0,
        )
    };
    if fd < 0 {
        return Err(PacketIssue::Unavailable);
    }
    // SAFETY: successful socket result has one owner.
    let connection = unsafe { OwnedFd::from_raw_fd(fd) };
    set_int(fd, libc::SO_PASSCRED, 1)?;
    prepare_buffer(fd)?;
    connect(fd, &address, length, deadline)?;
    let peer = peer_credentials(fd, expected_service_uid)?;
    send(fd, payload, deadline)?;
    let reply = receive(fd, peer, Instant::now() + BUDGET);
    drop(connection);
    reply
}

fn address(path: &Path) -> Result<(libc::sockaddr_un, libc::socklen_t), PacketIssue> {
    let bytes = path.as_os_str().as_bytes();
    if !path.is_absolute() || bytes.len() > 107 || bytes.contains(&0) {
        return Err(PacketIssue::InvalidInput);
    }
    // SAFETY: sockaddr_un consists of integer fields; zero is valid.
    let mut address: libc::sockaddr_un = unsafe { mem::zeroed() };
    address.sun_family = libc::AF_UNIX as libc::sa_family_t;
    for (dest, byte) in address.sun_path.iter_mut().zip(bytes) {
        *dest = *byte as libc::c_char;
    }
    let length = mem::offset_of!(libc::sockaddr_un, sun_path) + bytes.len() + 1;
    Ok((address, length as libc::socklen_t))
}

fn get_option<T: Copy>(fd: RawFd, option: libc::c_int) -> Result<T, PacketIssue> {
    let mut value = mem::MaybeUninit::<T>::uninit();
    let mut length = size_of::<T>() as libc::socklen_t;
    // SAFETY: output points to writable, suitably aligned storage of length bytes.
    let result = unsafe {
        libc::getsockopt(
            fd,
            libc::SOL_SOCKET,
            option,
            value.as_mut_ptr().cast(),
            &mut length,
        )
    };
    if result < 0 {
        return Err(descriptor_error());
    }
    if length as usize != size_of::<T>() {
        return Err(PacketIssue::Unavailable);
    }
    // SAFETY: successful getsockopt filled exactly the requested integer struct.
    Ok(unsafe { value.assume_init() })
}

fn set_int(fd: RawFd, option: libc::c_int, value: libc::c_int) -> Result<(), PacketIssue> {
    // SAFETY: value is readable for the stated size.
    let result = unsafe {
        libc::setsockopt(
            fd,
            libc::SOL_SOCKET,
            option,
            (&value as *const libc::c_int).cast(),
            size_of::<libc::c_int>() as libc::socklen_t,
        )
    };
    if result < 0 {
        Err(PacketIssue::Unavailable)
    } else {
        Ok(())
    }
}

fn validate_listener(fd: RawFd) -> Result<(), PacketIssue> {
    if get_option::<libc::c_int>(fd, libc::SO_TYPE)? != libc::SOCK_SEQPACKET
        || get_option::<libc::c_int>(fd, libc::SO_ACCEPTCONN)? != 1
        || get_option::<libc::c_int>(fd, libc::SO_PASSCRED)? != 1
    {
        return Err(PacketIssue::InvalidInput);
    }
    // SAFETY: fcntl probes integer flags on a borrowed descriptor.
    let status = unsafe { libc::fcntl(fd, libc::F_GETFL) };
    if status < 0 {
        return Err(descriptor_error());
    }
    // SAFETY: same as above.
    let flags = unsafe { libc::fcntl(fd, libc::F_GETFD) };
    if flags < 0 {
        return Err(descriptor_error());
    }
    if status & libc::O_NONBLOCK == 0 || flags & libc::FD_CLOEXEC == 0 {
        return Err(PacketIssue::InvalidInput);
    }
    // SAFETY: sockaddr_un is an integer struct with valid zero initialization.
    let mut address: libc::sockaddr_un = unsafe { mem::zeroed() };
    let mut length = size_of::<libc::sockaddr_un>() as libc::socklen_t;
    // SAFETY: output buffer and length describe the entire address storage.
    let result = unsafe {
        libc::getsockname(
            fd,
            (&mut address as *mut libc::sockaddr_un).cast(),
            &mut length,
        )
    };
    if result < 0 {
        return Err(descriptor_error());
    }
    let offset = mem::offset_of!(libc::sockaddr_un, sun_path);
    if address.sun_family as libc::c_int != libc::AF_UNIX
        || length as usize <= offset
        || address.sun_path[0] == 0
    {
        return Err(PacketIssue::InvalidInput);
    }
    Ok(())
}

fn prepare_buffer(fd: RawFd) -> Result<(), PacketIssue> {
    // Linux reports a doubled SO_SNDBUF; unix packet payload limit is that
    // reported capacity minus 32 bytes. Verify the actual value after capping.
    set_int(fd, libc::SO_SNDBUF, (MAX_PACKET_BYTES + 32) as libc::c_int)?;
    if get_option::<libc::c_int>(fd, libc::SO_SNDBUF)? < (MAX_PACKET_BYTES + 32) as libc::c_int {
        return Err(PacketIssue::Unavailable);
    }
    Ok(())
}

fn peer_credentials(fd: RawFd, expected_uid: u32) -> Result<PeerCredentials, PacketIssue> {
    let cred = get_option::<libc::ucred>(fd, libc::SO_PEERCRED)?;
    if cred.pid <= 0 || cred.uid != expected_uid {
        return Err(PacketIssue::Denied);
    }
    Ok(PeerCredentials {
        pid: cred.pid,
        uid: cred.uid,
        gid: cred.gid,
    })
}

fn errno() -> libc::c_int {
    io::Error::last_os_error().raw_os_error().unwrap_or(0)
}

fn descriptor_error() -> PacketIssue {
    match errno() {
        libc::EBADF | libc::ENOTSOCK => PacketIssue::InvalidInput,
        _ => PacketIssue::Unavailable,
    }
}

fn remaining(deadline: Instant) -> Result<libc::c_int, PacketIssue> {
    let duration = deadline.saturating_duration_since(Instant::now());
    if duration.is_zero() {
        return Err(PacketIssue::Unavailable);
    }
    Ok(duration.as_millis().saturating_add(1).min(i32::MAX as u128) as libc::c_int)
}

fn wait(fd: RawFd, events: libc::c_short, deadline: Instant) -> Result<(), PacketIssue> {
    loop {
        let mut pollfd = libc::pollfd {
            fd,
            events,
            revents: 0,
        };
        let timeout = remaining(deadline)?;
        // SAFETY: pollfd is a writable array of one entry, alive during poll.
        let result = unsafe { libc::poll(&mut pollfd, 1, timeout) };
        if result > 0 {
            return Ok(()); // Retry the nonblocking syscall even for HUP/ERR.
        }
        if result == 0 || errno() != libc::EINTR {
            return Err(PacketIssue::Unavailable);
        }
    }
}

fn accept(fd: RawFd, deadline: Instant) -> Result<OwnedFd, PacketIssue> {
    loop {
        remaining(deadline)?;
        // SAFETY: no address output requested, accepted socket is newly owned.
        let accepted = unsafe {
            libc::accept4(
                fd,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                libc::SOCK_NONBLOCK | libc::SOCK_CLOEXEC,
            )
        };
        if accepted >= 0 {
            // SAFETY: accept4 returned one new owned descriptor.
            return Ok(unsafe { OwnedFd::from_raw_fd(accepted) });
        }
        match errno() {
            libc::EINTR => continue,
            libc::EAGAIN => wait(fd, libc::POLLIN, deadline)?,
            _ => return Err(PacketIssue::Unavailable),
        }
    }
}

fn connect(
    fd: RawFd,
    address: &libc::sockaddr_un,
    length: libc::socklen_t,
    deadline: Instant,
) -> Result<(), PacketIssue> {
    loop {
        remaining(deadline)?;
        // SAFETY: address is initialized and length fits it.
        let result =
            unsafe { libc::connect(fd, (address as *const libc::sockaddr_un).cast(), length) };
        if result == 0 {
            return Ok(());
        }
        match errno() {
            libc::EISCONN => return Ok(()),
            libc::EINTR => continue,
            libc::EINPROGRESS | libc::EALREADY => {
                wait(fd, libc::POLLOUT, deadline)?;
                if get_option::<libc::c_int>(fd, libc::SO_ERROR)? != 0 {
                    return Err(PacketIssue::Unavailable);
                }
                return Ok(());
            }
            libc::EAGAIN => {
                // Unix backlog saturation is retryable, not completed connect.
                // Polling this unconnected socket for POLLOUT would busy-spin.
                let timeout = remaining(deadline)?.min(10);
                // SAFETY: poll with no descriptors is a bounded monotonic delay.
                let result = unsafe { libc::poll(std::ptr::null_mut(), 0, timeout) };
                if result < 0 && errno() != libc::EINTR {
                    return Err(PacketIssue::Unavailable);
                }
            }
            _ => return Err(PacketIssue::Unavailable),
        }
    }
}

fn check_size(bytes: &[u8]) -> Result<(), PacketIssue> {
    if bytes.is_empty() || bytes.len() > MAX_PACKET_BYTES {
        Err(PacketIssue::InvalidInput)
    } else {
        Ok(())
    }
}

fn send(fd: RawFd, bytes: &[u8], deadline: Instant) -> Result<(), PacketIssue> {
    check_size(bytes)?;
    loop {
        remaining(deadline)?;
        // SAFETY: input is readable for bytes.len(); NOSIGNAL prevents SIGPIPE.
        let result =
            unsafe { libc::send(fd, bytes.as_ptr().cast(), bytes.len(), libc::MSG_NOSIGNAL) };
        if result >= 0 {
            return if result as usize == bytes.len() {
                Ok(())
            } else {
                Err(PacketIssue::Unavailable)
            };
        }
        match errno() {
            libc::EINTR => continue,
            libc::EAGAIN => wait(fd, libc::POLLOUT, deadline)?,
            _ => return Err(PacketIssue::Unavailable),
        }
    }
}

fn receive(fd: RawFd, peer: PeerCredentials, deadline: Instant) -> Result<Vec<u8>, PacketIssue> {
    let mut bytes = vec![0u8; MAX_PACKET_BYTES];
    loop {
        remaining(deadline)?;
        // usize storage supplies cmsghdr alignment, bounded even for hostile
        // descriptor floods. Linux closes rights it cannot fit in this buffer.
        let mut control = [0usize; 64];
        let mut iov = libc::iovec {
            iov_base: bytes.as_mut_ptr().cast(),
            iov_len: bytes.len(),
        };
        // SAFETY: zeroed msghdr pointers/lengths start empty.
        let mut message: libc::msghdr = unsafe { mem::zeroed() };
        message.msg_iov = &mut iov;
        message.msg_iovlen = 1;
        message.msg_control = control.as_mut_ptr().cast();
        message.msg_controllen = size_of_val(&control);
        // SAFETY: all output buffers are writable and alive throughout recvmsg.
        let result = unsafe { libc::recvmsg(fd, &mut message, libc::MSG_CMSG_CLOEXEC) };
        if result < 0 {
            match errno() {
                libc::EINTR => continue,
                libc::EAGAIN => {
                    wait(fd, libc::POLLIN, deadline)?;
                    continue;
                }
                _ => return Err(PacketIssue::Unavailable),
            }
        }
        // Always drain delivered descriptor capabilities before any rejection.
        let (credentials, invalid_control) = inspect_control(&control, message.msg_controllen);
        if invalid_control || message.msg_flags & (libc::MSG_CTRUNC | libc::MSG_TRUNC) != 0 {
            return Err(PacketIssue::InvalidInput);
        }
        if result == 0 {
            return Err(if credentials.is_some() {
                PacketIssue::InvalidInput
            } else {
                PacketIssue::Unavailable
            });
        }
        if credentials != Some(peer) {
            return Err(PacketIssue::Denied);
        }
        bytes.truncate(result as usize);
        return Ok(bytes);
    }
}

fn inspect_control(control: &[usize], used: usize) -> (Option<PeerCredentials>, bool) {
    let mut credentials = None;
    let mut invalid = used > size_of_val(control);
    let used = used.min(size_of_val(control));
    let base = control.as_ptr().cast::<u8>();
    let mut offset = 0;
    // Linux CMSG_LEN(0), CMSG_ALIGN and header layout use native word alignment.
    let header_size = unsafe { libc::CMSG_LEN(0) } as usize;
    while used.saturating_sub(offset) >= size_of::<libc::cmsghdr>() {
        // SAFETY: header lies within initialized control bytes; unaligned reads
        // avoid relying on a particular cmsg alignment at subsequent offsets.
        let header = unsafe { std::ptr::read_unaligned(base.add(offset).cast::<libc::cmsghdr>()) };
        if header.cmsg_len < header_size || header.cmsg_len > used - offset {
            invalid = true;
            break;
        }
        let data_len = header.cmsg_len - header_size;
        // SAFETY: header_size and data length were checked against the buffer.
        let data = unsafe { base.add(offset + header_size) };
        if header.cmsg_level == libc::SOL_SOCKET
            && (header.cmsg_type == libc::SCM_RIGHTS || header.cmsg_type == SCM_PIDFD)
        {
            for index in 0..data_len / size_of::<libc::c_int>() {
                // SAFETY: each integer lies wholly inside this validated cmsg.
                let descriptor = unsafe {
                    std::ptr::read_unaligned(
                        data.add(index * size_of::<libc::c_int>())
                            .cast::<libc::c_int>(),
                    )
                };
                if descriptor >= 0 {
                    // SAFETY: SCM_RIGHTS/SCM_PIDFD deliver new owned descriptors.
                    drop(unsafe { OwnedFd::from_raw_fd(descriptor) });
                }
            }
            invalid = true;
        } else if header.cmsg_level == libc::SOL_SOCKET
            && header.cmsg_type == libc::SCM_CREDENTIALS
            && data_len == size_of::<libc::ucred>()
        {
            // SAFETY: exactly one complete kernel ucred fits this cmsg.
            let cred = unsafe { std::ptr::read_unaligned(data.cast::<libc::ucred>()) };
            if credentials.is_some() {
                invalid = true;
            }
            credentials = Some(PeerCredentials {
                pid: cred.pid,
                uid: cred.uid,
                gid: cred.gid,
            });
        } else {
            invalid = true;
        }
        offset += (header.cmsg_len + size_of::<usize>() - 1) & !(size_of::<usize>() - 1);
    }
    (credentials, invalid)
}
