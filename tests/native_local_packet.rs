#![cfg(target_os = "linux")]

use changekernel::local_packet::{request, serve_one, PacketIssue, MAX_PACKET_BYTES};
use std::ffi::OsString;
use std::fs::{self, File};
use std::mem::{self, size_of};
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd};
use std::os::unix::ffi::{OsStrExt, OsStringExt};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

static NEXT: AtomicUsize = AtomicUsize::new(0);
// Exclude unrelated child creation for the entire descriptor lifetime, including
// deliberately clearing CLOEXEC, spawning the chosen child and restoring it.
// Keep within-test threads concurrent; child entries run in separate processes.
static TEST_GATE: Mutex<()> = Mutex::new(());

fn uid() -> u32 {
    unsafe { libc::getuid() }
}

fn wrong_uid() -> u32 {
    uid().wrapping_add(1)
}

fn option(fd: RawFd, name: i32, value: i32) {
    assert_eq!(
        unsafe {
            libc::setsockopt(
                fd,
                libc::SOL_SOCKET,
                name,
                (&value as *const i32).cast(),
                size_of::<i32>() as _,
            )
        },
        0
    );
}

fn socket(nonblocking: bool) -> OwnedFd {
    let flags = libc::SOCK_SEQPACKET
        | libc::SOCK_CLOEXEC
        | if nonblocking { libc::SOCK_NONBLOCK } else { 0 };
    let fd = unsafe { libc::socket(libc::AF_UNIX, flags, 0) };
    assert!(fd >= 0);
    let fd = unsafe { OwnedFd::from_raw_fd(fd) };
    option(fd.as_raw_fd(), libc::SO_PASSCRED, 1);
    option(
        fd.as_raw_fd(),
        libc::SO_SNDBUF,
        (MAX_PACKET_BYTES + 65_536) as i32,
    );
    fd
}

fn address(path: &Path) -> (libc::sockaddr_un, libc::socklen_t) {
    let bytes = path.as_os_str().as_bytes();
    assert!(bytes.len() <= 107);
    let mut addr: libc::sockaddr_un = unsafe { mem::zeroed() };
    addr.sun_family = libc::AF_UNIX as _;
    for (dst, src) in addr.sun_path.iter_mut().zip(bytes) {
        *dst = *src as _;
    }
    (
        addr,
        (mem::offset_of!(libc::sockaddr_un, sun_path) + bytes.len() + 1) as _,
    )
}

struct Fixture {
    directory: PathBuf,
    endpoint: PathBuf,
    listener: OwnedFd,
}

impl Fixture {
    fn new() -> Self {
        Self::named(OsString::from("socket"))
    }

    fn named(name: OsString) -> Self {
        Self::with_name(|_| name)
    }

    fn with_name(name: impl FnOnce(&Path) -> OsString) -> Self {
        let directory = std::env::temp_dir().join(format!(
            "ck-packet-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        let endpoint = directory.join(name(&directory));
        let listener = socket(true);
        let (addr, len) = address(&endpoint);
        assert_eq!(
            unsafe {
                libc::bind(
                    listener.as_raw_fd(),
                    (&addr as *const libc::sockaddr_un).cast(),
                    len,
                )
            },
            0
        );
        assert_eq!(unsafe { libc::listen(listener.as_raw_fd(), 8) }, 0);
        Self {
            directory,
            endpoint,
            listener,
        }
    }

    fn connect(&self) -> OwnedFd {
        let connection = socket(false);
        let (addr, len) = address(&self.endpoint);
        assert_eq!(
            unsafe {
                libc::connect(
                    connection.as_raw_fd(),
                    (&addr as *const libc::sockaddr_un).cast(),
                    len,
                )
            },
            0
        );
        connection
    }

    fn accept(&self) -> OwnedFd {
        let mut pfd = libc::pollfd {
            fd: self.listener.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        assert_eq!(unsafe { libc::poll(&mut pfd, 1, 2_000) }, 1);
        let fd = unsafe {
            libc::accept4(
                self.listener.as_raw_fd(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                libc::SOCK_CLOEXEC,
            )
        };
        assert!(fd >= 0);
        unsafe { OwnedFd::from_raw_fd(fd) }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.directory).unwrap();
    }
}

fn raw_send(fd: RawFd, bytes: &[u8]) {
    assert_eq!(
        unsafe { libc::send(fd, bytes.as_ptr().cast(), bytes.len(), libc::MSG_NOSIGNAL) },
        bytes.len() as isize
    );
}

fn send_rights(fd: RawFd, descriptors: &[RawFd]) {
    let byte = [42u8];
    let mut iov = libc::iovec {
        iov_base: byte.as_ptr().cast_mut().cast(),
        iov_len: 1,
    };
    let space = unsafe { libc::CMSG_SPACE(mem::size_of_val(descriptors) as _) } as usize;
    let mut control = vec![0usize; space.div_ceil(size_of::<usize>())];
    let mut msg: libc::msghdr = unsafe { mem::zeroed() };
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = control.as_mut_ptr().cast();
    msg.msg_controllen = space;
    unsafe {
        let cmsg = libc::CMSG_FIRSTHDR(&msg);
        (*cmsg).cmsg_level = libc::SOL_SOCKET;
        (*cmsg).cmsg_type = libc::SCM_RIGHTS;
        (*cmsg).cmsg_len = libc::CMSG_LEN(mem::size_of_val(descriptors) as _) as usize;
        std::ptr::copy_nonoverlapping(
            descriptors.as_ptr().cast::<u8>(),
            libc::CMSG_DATA(cmsg),
            mem::size_of_val(descriptors),
        );
        assert_eq!(libc::sendmsg(fd, &msg, libc::MSG_NOSIGNAL), 1);
    }
}

fn receive_right(fd: RawFd) -> OwnedFd {
    let mut byte = [0u8];
    let mut iov = libc::iovec {
        iov_base: byte.as_mut_ptr().cast(),
        iov_len: 1,
    };
    let mut control = [0usize; 8];
    let mut msg: libc::msghdr = unsafe { mem::zeroed() };
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = control.as_mut_ptr().cast();
    msg.msg_controllen = mem::size_of_val(&control);
    unsafe {
        assert_eq!(libc::recvmsg(fd, &mut msg, libc::MSG_CMSG_CLOEXEC), 1);
        let cmsg = libc::CMSG_FIRSTHDR(&msg);
        assert!(!cmsg.is_null());
        assert_eq!((*cmsg).cmsg_type, libc::SCM_RIGHTS);
        OwnedFd::from_raw_fd(std::ptr::read_unaligned(libc::CMSG_DATA(cmsg).cast()))
    }
}

fn inheritable(fd: RawFd) {
    assert_eq!(unsafe { libc::fcntl(fd, libc::F_SETFD, 0) }, 0);
}

fn child(test: &str, fd: Option<RawFd>, mode: &str) -> std::process::Child {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command.args(["--ignored", "--exact", test, "--nocapture"]);
    command.env("CK_PACKET_CHILD", mode);
    if let Some(fd) = fd {
        command.env("CK_PACKET_FD", fd.to_string());
    }
    let child = command.spawn().unwrap();
    if let Some(fd) = fd {
        // Only this child may inherit the deliberately passed descriptor.
        assert_eq!(
            unsafe { libc::fcntl(fd, libc::F_SETFD, libc::FD_CLOEXEC) },
            0
        );
    }
    child
}

#[test]
fn binary_and_maximum_round_trips() {
    let _gate = TEST_GATE.lock().unwrap();
    for bytes in [vec![0, 255, 1, 0, 128], vec![93; MAX_PACKET_BYTES]] {
        let fixture = Fixture::new();
        thread::scope(|scope| {
            let server = scope.spawn(|| {
                serve_one(&fixture.listener, uid(), |peer, input| {
                    assert_eq!(peer.pid, std::process::id() as i32);
                    assert_eq!(peer.uid, uid());
                    assert_eq!(peer.gid, unsafe { libc::getgid() });
                    Ok(input)
                })
            });
            assert_eq!(request(&fixture.endpoint, uid(), &bytes), Ok(bytes));
            assert_eq!(server.join().unwrap(), Ok(()));
        });
    }
}

#[test]
fn native_non_utf8_endpoint_and_preaccept_packet() {
    let _gate = TEST_GATE.lock().unwrap();
    for fixture in [
        Fixture::named(OsString::from_vec(b"socket-\xff".to_vec())),
        Fixture::with_name(|directory| {
            OsString::from("x".repeat(107 - directory.as_os_str().as_bytes().len() - 1))
        }),
    ] {
        thread::scope(|scope| {
            let server = scope.spawn(|| serve_one(&fixture.listener, uid(), |_, data| Ok(data)));
            assert_eq!(
                request(&fixture.endpoint, uid(), b"native"),
                Ok(b"native".to_vec())
            );
            assert_eq!(server.join().unwrap(), Ok(()));
        });
    }
    let fixture = Fixture::new();
    let connection = fixture.connect();
    raw_send(connection.as_raw_fd(), b"already queued");
    assert_eq!(
        serve_one(&fixture.listener, uid(), |_, data| {
            assert_eq!(data, b"already queued");
            Ok(vec![1])
        }),
        Ok(())
    );
}

#[test]
fn configured_peer_and_service_uid_denials() {
    let _gate = TEST_GATE.lock().unwrap();
    let fixture = Fixture::new();
    let connection = fixture.connect();
    raw_send(connection.as_raw_fd(), b"untrusted");
    assert_eq!(
        serve_one(&fixture.listener, wrong_uid(), |_, _| panic!(
            "denied input entered handler"
        )),
        Err(PacketIssue::Denied)
    );
    drop(connection);
    thread::scope(|scope| {
        let server = scope.spawn(|| {
            serve_one(&fixture.listener, uid(), |_, _| {
                panic!("client UID denial must send nothing")
            })
        });
        assert_eq!(
            request(&fixture.endpoint, wrong_uid(), b"untrusted"),
            Err(PacketIssue::Denied)
        );
        assert_eq!(server.join().unwrap(), Err(PacketIssue::Unavailable));
    });
}

#[test]
fn inherited_and_transferred_connections_deny_different_sender_process() {
    let _gate = TEST_GATE.lock().unwrap();
    for mode in ["inherit", "transfer"] {
        let fixture = Fixture::new();
        let connection = fixture.connect(); // SO_PEERCRED caches this parent PID.
        let (parent, ipc) = UnixStream::pair().unwrap();
        let fd = if mode == "inherit" {
            connection.as_raw_fd()
        } else {
            ipc.as_raw_fd()
        };
        inheritable(fd);
        let mut sender = child("child_sender", Some(fd), mode);
        if mode == "transfer" {
            send_rights(parent.as_raw_fd(), &[connection.as_raw_fd()]);
        }
        assert!(sender.wait().unwrap().success());
        assert_eq!(
            serve_one(&fixture.listener, uid(), |_, _| panic!(
                "different packet PID entered handler"
            )),
            Err(PacketIssue::Denied)
        );
    }
}

#[test]
#[ignore = "subprocess entry; exercised by parent tests"]
fn child_sender() {
    let fd: RawFd = std::env::var("CK_PACKET_FD").unwrap().parse().unwrap();
    let mode = std::env::var("CK_PACKET_CHILD").unwrap();
    let received = (mode == "transfer").then(|| receive_right(fd));
    raw_send(
        received.as_ref().map_or(fd, AsRawFd::as_raw_fd),
        b"different process",
    );
}

#[test]
fn empty_oversized_and_invalid_reply_packets() {
    let _gate = TEST_GATE.lock().unwrap();
    for payload in [vec![], vec![0; MAX_PACKET_BYTES + 1]] {
        let fixture = Fixture::new();
        let connection = fixture.connect();
        raw_send(connection.as_raw_fd(), &payload);
        assert_eq!(
            serve_one(&fixture.listener, uid(), |_, _| panic!(
                "bad packet entered handler"
            )),
            Err(PacketIssue::InvalidInput)
        );
        assert_eq!(
            request(&fixture.endpoint, uid(), &payload),
            Err(PacketIssue::InvalidInput)
        );
    }
    for reply in [vec![], vec![0; MAX_PACKET_BYTES + 1]] {
        let fixture = Fixture::new();
        thread::scope(|scope| {
            let server = scope.spawn(|| serve_one(&fixture.listener, uid(), |_, _| Ok(reply)));
            assert_eq!(
                request(&fixture.endpoint, uid(), b"valid"),
                Err(PacketIssue::Unavailable)
            );
            assert_eq!(server.join().unwrap(), Err(PacketIssue::InvalidInput));
        });
    }
}

#[test]
fn ancillary_descriptors_are_rejected_and_closed_including_truncation() {
    let _gate = TEST_GATE.lock().unwrap();
    assert!(child("ancillary_cleanup_child", None, "cleanup")
        .wait()
        .unwrap()
        .success());
}

#[test]
#[ignore = "isolated subprocess for reliable descriptor accounting"]
fn ancillary_cleanup_child() {
    assert_eq!(std::env::var("CK_PACKET_CHILD").unwrap(), "cleanup");
    let count = || fs::read_dir("/proc/self/fd").unwrap().count();
    let fixture = Fixture::new();
    let source = File::open("/dev/null").unwrap();
    for number in [1, 253] {
        for _ in 0..4 {
            let connection = fixture.connect();
            let baseline = count();
            send_rights(connection.as_raw_fd(), &vec![source.as_raw_fd(); number]);
            assert_eq!(
                serve_one(&fixture.listener, uid(), |_, _| panic!(
                    "rights entered handler"
                )),
                Err(PacketIssue::InvalidInput)
            );
            assert_eq!(count(), baseline, "received capabilities leaked");
        }
        // Exercise the same cleanup obligation on the client's reply path.
        let baseline = count();
        thread::scope(|scope| {
            let server = scope.spawn(|| {
                let connection = fixture.accept();
                let mut bytes = [0u8; 16];
                assert!(
                    unsafe {
                        libc::recv(
                            connection.as_raw_fd(),
                            bytes.as_mut_ptr().cast(),
                            bytes.len(),
                            0,
                        )
                    } > 0
                );
                send_rights(connection.as_raw_fd(), &vec![source.as_raw_fd(); number]);
            });
            assert_eq!(
                request(&fixture.endpoint, uid(), b"request"),
                Err(PacketIssue::InvalidInput)
            );
            server.join().unwrap();
        });
        assert_eq!(count(), baseline, "reply capabilities leaked");
    }
    // Linux SO_PASSPIDFD (76) is optional on older kernels. If supported,
    // it is inherited by accepted sockets and delivers an SCM_PIDFD capability.
    let enabled = 1i32;
    let supported = unsafe {
        libc::setsockopt(
            fixture.listener.as_raw_fd(),
            libc::SOL_SOCKET,
            76,
            (&enabled as *const i32).cast(),
            size_of::<i32>() as _,
        )
    };
    if supported == 0 {
        let connection = fixture.connect();
        let baseline = count();
        raw_send(connection.as_raw_fd(), b"pidfd");
        assert_eq!(
            serve_one(&fixture.listener, uid(), |_, _| panic!(
                "PID descriptor entered handler"
            )),
            Err(PacketIssue::InvalidInput)
        );
        assert_eq!(count(), baseline, "received PID descriptor leaked");
    } else {
        let error = std::io::Error::last_os_error().raw_os_error().unwrap();
        assert!(matches!(error, libc::ENOPROTOOPT | libc::EINVAL));
        eprintln!("SO_PASSPIDFD unsupported on this kernel; PID descriptor case not exercised");
    }
}

#[test]
fn peer_closure_callback_errors_and_single_packet_consumption() {
    let _gate = TEST_GATE.lock().unwrap();
    let fixture = Fixture::new();
    drop(fixture.connect());
    assert_eq!(
        serve_one(&fixture.listener, uid(), |_, _| panic!(
            "EOF entered handler"
        )),
        Err(PacketIssue::Unavailable)
    );
    let connection = fixture.connect();
    raw_send(connection.as_raw_fd(), b"one");
    raw_send(connection.as_raw_fd(), b"two");
    assert_eq!(
        serve_one(&fixture.listener, uid(), |_, input| {
            assert_eq!(input, b"one");
            Err(PacketIssue::Denied)
        }),
        Err(PacketIssue::Denied)
    );
    drop(connection);
    let connection = fixture.connect();
    raw_send(connection.as_raw_fd(), b"one");
    drop(connection);
    assert_eq!(
        serve_one(&fixture.listener, uid(), |_, _| Ok(
            b"reply after close".to_vec()
        )),
        Err(PacketIssue::Unavailable)
    );
}

#[test]
fn reply_credentials_and_reply_framing_are_checked() {
    let _gate = TEST_GATE.lock().unwrap();
    for mode in [
        "empty",
        "large",
        "rights",
        "no credentials",
        "other process",
    ] {
        let fixture = Fixture::new();
        thread::scope(|scope| {
            let server = scope.spawn(|| {
                let connection = fixture.accept();
                let mut bytes = [0u8; 128];
                assert!(
                    unsafe {
                        libc::recv(
                            connection.as_raw_fd(),
                            bytes.as_mut_ptr().cast(),
                            bytes.len(),
                            0,
                        )
                    } > 0
                );
                match mode {
                    "empty" => raw_send(connection.as_raw_fd(), b""),
                    "large" => raw_send(connection.as_raw_fd(), &vec![1; MAX_PACKET_BYTES + 1]),
                    "rights" => send_rights(connection.as_raw_fd(), &[connection.as_raw_fd()]),
                    "no credentials" => { /* EOF, not an invented credential envelope. */ }
                    "other process" => {
                        inheritable(connection.as_raw_fd());
                        assert!(
                            child("child_sender", Some(connection.as_raw_fd()), "inherit")
                                .wait()
                                .unwrap()
                                .success()
                        );
                    }
                    _ => unreachable!(),
                }
            });
            let expected = match mode {
                "other process" => PacketIssue::Denied,
                "no credentials" => PacketIssue::Unavailable,
                _ => PacketIssue::InvalidInput,
            };
            assert_eq!(request(&fixture.endpoint, uid(), b"request"), Err(expected));
            server.join().unwrap();
        });
    }
}

#[test]
fn invalid_endpoint_and_listener_configuration() {
    let _gate = TEST_GATE.lock().unwrap();
    let long = PathBuf::from(format!("/{}", "x".repeat(107)));
    let nul = PathBuf::from(OsString::from_vec(b"/tmp/a\0b".to_vec()));
    for path in [Path::new("relative"), &long, &nul] {
        assert_eq!(request(path, uid(), b"x"), Err(PacketIssue::InvalidInput));
    }
    let file = File::open("/dev/null").unwrap();
    let fd: OwnedFd = file.into();
    assert_eq!(
        serve_one(&fd, uid(), |_, _| panic!()),
        Err(PacketIssue::InvalidInput)
    );
    let unbound = socket(true);
    assert_eq!(
        serve_one(&unbound, uid(), |_, _| panic!()),
        Err(PacketIssue::InvalidInput)
    );
    for (command, flags) in [(libc::F_SETFD, 0), (libc::F_SETFL, 0)] {
        let fixture = Fixture::new();
        assert_eq!(
            unsafe { libc::fcntl(fixture.listener.as_raw_fd(), command, flags) },
            0
        );
        assert_eq!(
            serve_one(&fixture.listener, uid(), |_, _| panic!()),
            Err(PacketIssue::InvalidInput)
        );
    }
    let fixture = Fixture::new();
    option(fixture.listener.as_raw_fd(), libc::SO_PASSCRED, 0);
    assert_eq!(
        serve_one(&fixture.listener, uid(), |_, _| panic!()),
        Err(PacketIssue::InvalidInput)
    );
    assert_eq!(
        request(&fixture.directory.join("missing"), uid(), b"x"),
        Err(PacketIssue::Unavailable)
    );
    let stream = std::os::unix::net::UnixListener::bind(fixture.directory.join("stream")).unwrap();
    stream.set_nonblocking(true).unwrap();
    let stream: OwnedFd = stream.into();
    option(stream.as_raw_fd(), libc::SO_PASSCRED, 1);
    assert_eq!(
        serve_one(&stream, uid(), |_, _| panic!()),
        Err(PacketIssue::InvalidInput)
    );

    let abstract_socket = socket(true);
    let mut addr: libc::sockaddr_un = unsafe { mem::zeroed() };
    addr.sun_family = libc::AF_UNIX as _;
    let name = format!(
        "ck-packet-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    for (dst, src) in addr.sun_path[1..].iter_mut().zip(name.bytes()) {
        *dst = src as _;
    }
    let len = (mem::offset_of!(libc::sockaddr_un, sun_path) + 1 + name.len()) as libc::socklen_t;
    assert_eq!(
        unsafe {
            libc::bind(
                abstract_socket.as_raw_fd(),
                (&addr as *const libc::sockaddr_un).cast(),
                len,
            )
        },
        0
    );
    assert_eq!(unsafe { libc::listen(abstract_socket.as_raw_fd(), 1) }, 0);
    assert_eq!(
        serve_one(&abstract_socket, uid(), |_, _| panic!()),
        Err(PacketIssue::InvalidInput)
    );
}

#[test]
fn accept_receive_and_client_receive_waits_are_finite() {
    let _gate = TEST_GATE.lock().unwrap();
    // Run the three independent five-second budgets concurrently.
    thread::scope(|scope| {
        let accept = scope.spawn(|| {
            let fixture = Fixture::new();
            let start = Instant::now();
            assert_eq!(
                serve_one(&fixture.listener, uid(), |_, _| panic!()),
                Err(PacketIssue::Unavailable)
            );
            assert!((Duration::from_secs(4)..Duration::from_secs(8)).contains(&start.elapsed()));
        });
        let receive = scope.spawn(|| {
            let fixture = Fixture::new();
            let _silent = fixture.connect();
            let start = Instant::now();
            assert_eq!(
                serve_one(&fixture.listener, uid(), |_, _| panic!()),
                Err(PacketIssue::Unavailable)
            );
            assert!((Duration::from_secs(4)..Duration::from_secs(8)).contains(&start.elapsed()));
        });
        let connect = scope.spawn(|| {
            let fixture = Fixture::new();
            assert_eq!(unsafe { libc::listen(fixture.listener.as_raw_fd(), 0) }, 0);
            let _full_backlog = fixture.connect();
            let start = Instant::now();
            assert_eq!(
                request(&fixture.endpoint, uid(), b"blocked backlog"),
                Err(PacketIssue::Unavailable)
            );
            assert!((Duration::from_secs(4)..Duration::from_secs(8)).contains(&start.elapsed()));
        });
        let client =
            scope.spawn(|| {
                let fixture = Fixture::new();
                thread::scope(|inner| {
                    let server = inner.spawn(|| {
                        let connection = fixture.accept();
                        thread::sleep(Duration::from_millis(5_600));
                        drop(connection);
                    });
                    let start = Instant::now();
                    assert_eq!(
                        request(&fixture.endpoint, uid(), b"silent service"),
                        Err(PacketIssue::Unavailable)
                    );
                    assert!(
                        (Duration::from_secs(4)..Duration::from_secs(8)).contains(&start.elapsed())
                    );
                    server.join().unwrap();
                });
            });
        accept.join().unwrap();
        receive.join().unwrap();
        connect.join().unwrap();
        client.join().unwrap();
    });
}

#[test]
fn interrupted_wait_does_not_reset_deadline() {
    let _gate = TEST_GATE.lock().unwrap();
    assert!(child("interrupted_wait_child", None, "interrupt")
        .wait()
        .unwrap()
        .success());
}

#[test]
#[ignore = "isolated subprocess; signal disposition must not affect other tests"]
fn interrupted_wait_child() {
    use std::sync::atomic::AtomicBool;
    static SIGNALS: AtomicUsize = AtomicUsize::new(0);
    extern "C" fn on_signal(_: i32) {
        SIGNALS.fetch_add(1, Ordering::Relaxed);
    }
    assert_eq!(std::env::var("CK_PACKET_CHILD").unwrap(), "interrupt");
    let mut action: libc::sigaction = unsafe { mem::zeroed() };
    action.sa_sigaction = on_signal as *const () as usize;
    assert_eq!(unsafe { libc::sigemptyset(&mut action.sa_mask) }, 0);
    let mut old: libc::sigaction = unsafe { mem::zeroed() };
    assert_eq!(
        unsafe { libc::sigaction(libc::SIGUSR1, &action, &mut old) },
        0
    );
    let target = unsafe { libc::pthread_self() };
    let stop = AtomicBool::new(false);
    let fixture = Fixture::new();
    thread::scope(|scope| {
        let signaler = scope.spawn(|| {
            while !stop.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(20));
                assert_eq!(unsafe { libc::pthread_kill(target, libc::SIGUSR1) }, 0);
            }
        });
        let start = Instant::now();
        let result = serve_one(&fixture.listener, uid(), |_, _| panic!("no packet"));
        stop.store(true, Ordering::Relaxed);
        signaler.join().unwrap();
        assert_eq!(result, Err(PacketIssue::Unavailable));
        assert!((Duration::from_secs(4)..Duration::from_secs(8)).contains(&start.elapsed()));
        assert!(SIGNALS.load(Ordering::Relaxed) > 10);
    });
    assert_eq!(
        unsafe { libc::sigaction(libc::SIGUSR1, &old, std::ptr::null_mut()) },
        0
    );
}
