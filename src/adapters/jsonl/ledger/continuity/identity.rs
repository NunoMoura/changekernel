//! Linux v6.12, x86_64 LE LP64 held-fd btrfs identity. No handle reopening.
use super::super::layout::Layout;
use super::super::{
    codec::{field_key, required},
    storage::{Context, TrackedFile},
    work::{self, Boundary as B, Heap},
};
use super::{
    LedgerContinuityIoFault as Fault, LedgerIdentityObject as Object, LedgerIdentityStep as Step,
};
use crate::adapters::jsonl::opening::storage::Failure;
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::{fmt, os::fd::AsRawFd};
const MECHANISM: &str = "btrfs-fsid-fh@1";
#[derive(Clone, Copy, Debug)]
pub(crate) struct Identity {
    pub fsid: [u8; 16],
    pub handle: [u8; 20],
}
impl PartialEq for Identity {
    fn eq(&self, other: &Self) -> bool {
        // Parent compound comparison charges its available logical raw payload.
        work::update(|w| w.identity_raw_operand_bytes += 36);
        work::test(B::IdentityComparisons, 36, 3, || {
            self.fsid == other.fsid && self.handle == other.handle
        })
    }
}
impl Eq for Identity {}
impl Heap for Identity {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        36
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Pair {
    pub directory: Identity,
    pub lock: Identity,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Shared {
    pub directory: Identity,
    pub lock: Identity,
    pub members: Identity,
}
impl Heap for Shared {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        108
    }
}
pub(crate) fn format(bytes: usize, words: usize, raw: bool, f: impl FnOnce() -> bool) -> bool {
    work::update(|w| {
        if raw {
            w.identity_raw_operand_bytes += bytes as u64
        } else {
            w.identity_text_operand_bytes += bytes as u64
        }
    });
    work::attempt(B::Fields, bytes, words);
    let ok = work::test(B::IdentityFormat, bytes, words, f);
    work::complete(B::Fields, ok);
    ok
}
impl Identity {
    fn valid(&self) -> bool {
        format(16, 1, true, || self.fsid.iter().any(|b| *b != 0))
            && format(20, 1, true, || self.handle.iter().any(|b| *b != 0))
    }
}
fn same_fs(a: &Identity, b: &Identity) -> bool {
    work::update(|w| w.identity_raw_operand_bytes += 16);
    work::attempt(B::Relationships, 16, 1);
    let ok = work::test(B::IdentityComparisons, 16, 1, || a.fsid == b.fsid);
    work::complete(B::Relationships, ok);
    ok
}
impl Pair {
    pub fn common(&self, root: &Identity) -> Result<(), Failure> {
        if same_fs(&self.directory, &self.lock) && same_fs(&self.directory, root) {
            Ok(())
        } else {
            Err(Failure::damage())
        }
    }
}
impl Shared {
    pub(in crate::adapters::jsonl::ledger) fn pair(&self) -> Pair {
        Pair {
            directory: self.directory,
            lock: self.lock,
        }
    }
    pub fn common(&self) -> Result<(), Failure> {
        if same_fs(&self.directory, &self.lock) && same_fs(&self.directory, &self.members) {
            Ok(())
        } else {
            Err(Failure::damage())
        }
    }
}
struct FixedText<const N: usize>([u8; N]);
impl<'de, const N: usize> Deserialize<'de> for FixedText<N> {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Text<const N: usize>;
        impl<'de, const N: usize> Visitor<'de> for Text<N> {
            type Value = FixedText<N>;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("fixed unescaped identity text")
            }
            fn visit_borrowed_str<E: de::Error>(self, s: &'de str) -> Result<Self::Value, E> {
                if !format(s.len(), 1, false, || s.len() == N) {
                    return Err(E::custom("identity extent"));
                }
                let mut out = [0; N];
                out.copy_from_slice(s.as_bytes());
                Ok(FixedText(out))
            }
        }
        d.deserialize_newtype_struct(
            match N {
                15 => "ck_identity_mechanism",
                32 => "ck_identity_fsid",
                40 => "ck_identity_handle",
                _ => unreachable!(),
            },
            Text::<N>,
        )
    }
}
fn hex<const N: usize, E: de::Error>(s: &[u8]) -> Result<[u8; N], E> {
    let mut out = [0; N];
    for (i, pair) in s.chunks_exact(2).enumerate() {
        if !format(2, 1, false, || {
            pair.iter()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(b))
        }) {
            return Err(E::custom("identity hex"));
        }
        fn nibble(b: u8) -> u8 {
            if b <= b'9' {
                b - b'0'
            } else {
                b - b'a' + 10
            }
        }
        out[i] = nibble(pair[0]) * 16 + nibble(pair[1]);
    }
    Ok(out)
}
struct Integer(u64);
impl<'de> Deserialize<'de> for Integer {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Number;
        impl<'de> Visitor<'de> for Number {
            type Value = Integer;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("identity scalar integer")
            }
            fn visit_u64<E: de::Error>(self, n: u64) -> Result<Integer, E> {
                Ok(Integer(n))
            }
        }
        d.deserialize_newtype_struct("ck_identity_integer", Number)
    }
}
impl<'de> Deserialize<'de> for Identity {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Token;
        impl<'de> Visitor<'de> for Token {
            type Value = Identity;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed btrfs identity")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Identity, M::Error> {
                let _fixed = work::Fixed::new(std::mem::size_of::<Identity>() + 8);
                let mut mask = 0u8;
                let mut fsid = None;
                let mut handle = None;
                while let Some(key) = m.next_key::<String>()? {
                    let key = work::Owned::new(key);
                    field_key(
                        &key,
                        &["mechanism", "fsid", "handle_type", "handle_bytes", "handle"],
                    );
                    let bit = match key.as_str() {
                        "mechanism" => 1,
                        "fsid" => 2,
                        "handle_type" => 4,
                        "handle_bytes" => 8,
                        "handle" => 16,
                        _ => {
                            work::complete(B::Fields, false);
                            return Err(de::Error::custom("identity field"));
                        }
                    };
                    work::complete(B::Fields, true);
                    if !format(0, 1, true, || mask & bit == 0) {
                        return Err(de::Error::custom("duplicate identity"));
                    }
                    mask |= bit;
                    match bit {
                        1 => {
                            let s = m.next_value::<FixedText<15>>()?;
                            if !format(15, 1, false, || s.0.as_slice() == MECHANISM.as_bytes()) {
                                return Err(de::Error::custom("identity mechanism"));
                            }
                        }
                        2 => {
                            let s = m.next_value::<FixedText<32>>()?;
                            fsid = Some(hex::<16, M::Error>(&s.0)?);
                        }
                        4 => {
                            let n = m.next_value::<Integer>()?.0;
                            if !format(0, 1, true, || n == 77) {
                                return Err(de::Error::custom("identity type"));
                            }
                        }
                        8 => {
                            let n = m.next_value::<Integer>()?.0;
                            if !format(0, 1, true, || n == 20) {
                                return Err(de::Error::custom("identity size"));
                            }
                        }
                        16 => {
                            let s = m.next_value::<FixedText<40>>()?;
                            handle = Some(hex::<20, M::Error>(&s.0)?);
                        }
                        _ => unreachable!(),
                    }
                }
                if !format(0, 5, true, || mask == 31) {
                    return Err(de::Error::custom("missing identity"));
                }
                let id = Identity {
                    fsid: required(fsid, "fsid")?,
                    handle: required(handle, "handle")?,
                };
                if !id.valid() {
                    return Err(de::Error::custom("zero identity"));
                }
                Ok(id)
            }
        }
        d.deserialize_map(Token)
    }
}
fn encode<const N: usize>(bytes: &[u8], out: &mut [u8; N]) {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    for (i, b) in bytes.iter().enumerate() {
        format(1, 1, true, || true);
        out[2 * i] = HEX[(b >> 4) as usize];
        out[2 * i + 1] = HEX[(b & 15) as usize];
    }
}
impl Serialize for Identity {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let _fixed = work::Fixed::new(72);
        if !self.valid() {
            return Err(serde_core::ser::Error::custom("zero identity"));
        }
        let mut fsid = [0; 32];
        let mut handle = [0; 40];
        encode(&self.fsid, &mut fsid);
        encode(&self.handle, &mut handle);
        let mut o = s.serialize_struct("identity", 5)?;
        o.serialize_field("mechanism", MECHANISM)?;
        o.serialize_field("fsid", std::str::from_utf8(&fsid).unwrap())?;
        o.serialize_field("handle_type", &77u64)?;
        o.serialize_field("handle_bytes", &20u64)?;
        o.serialize_field("handle", std::str::from_utf8(&handle).unwrap())?;
        o.end()
    }
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
fn errno(n: i32) -> Failure {
    if matches!(n, libc::EIO | libc::EUCLEAN | libc::EREMOTEIO) {
        work::update(|w| w.identity_io_failures += 1);
        Failure::io()
    } else {
        Failure::damage()
    }
}
fn before<P: Layout>(
    ctx: &mut Context<P>,
    scope: u8,
    object: Object,
    step: Step,
    b: B,
    capacity: usize,
    syscall: impl FnOnce() -> i32,
) -> Result<(), Failure> {
    let fault = ctx.identity_event(scope, object, step)?;
    let substitute = match fault {
        Fault::Continue => None,
        Fault::Io => Some(libc::EIO),
        Fault::NativeErrno(n) if (1..=4095).contains(&n) => Some(n),
        _ => return Err(Failure::damage()),
    };
    work::attempt(b, 0, 4);
    work::update(|w| w.native_buffer_bytes += capacity as u64);
    let rc = if substitute.is_some() { -1 } else { syscall() };
    work::complete(b, rc == 0);
    if rc != 0 {
        return Err(errno(substitute.unwrap_or_else(|| {
            std::io::Error::last_os_error()
                .raw_os_error()
                .unwrap_or(libc::EINVAL)
        })));
    }
    Ok(())
}
fn after<P: Layout>(
    ctx: &mut Context<P>,
    scope: u8,
    object: Object,
    step: Step,
) -> Result<(), Failure> {
    match ctx.identity_event(scope, object, step)? {
        Fault::Continue => Ok(()),
        Fault::MalformedIdentity => {
            format(0, 1, true, || false);
            Err(Failure::damage())
        }
        _ => Err(Failure::damage()),
    }
}
pub(in crate::adapters::jsonl::ledger) fn acquire<P: Layout>(
    ctx: &mut Context<P>,
    scope: u8,
    object: Object,
    fd: &TrackedFile,
) -> Result<Identity, Failure> {
    work::attempt(B::IdentityAcquisitions, 0, 1);
    let result = (|| {
        if !supported() {
            return Err(Failure::damage());
        }
        // Secure opens already checked roles/nlink and use normal descriptors.
        // SAFETY: initialized native output, live owned fd. Exactly one attempt.
        let mut fs: libc::statfs = unsafe { std::mem::zeroed() };
        let mut info: FsInfo = unsafe { std::mem::zeroed() };
        let mut handle = Handle {
            bytes: 128,
            kind: 0,
            data: [0; 128],
        };
        let mut mount = 0i32;
        let scratch = std::mem::size_of_val(&fs)
            + std::mem::size_of_val(&info)
            + std::mem::size_of_val(&handle)
            + std::mem::size_of_val(&mount)
            + 64;
        let _fixed = work::Fixed::new(scratch);
        work::update(|w| {
            w.identity_scratch_bytes_peak = w.identity_scratch_bytes_peak.max(scratch as u64)
        });
        before(
            ctx,
            scope,
            object,
            Step::BeforeFsType,
            B::NativeFstype,
            std::mem::size_of_val(&fs),
            || unsafe { libc::fstatfs(fd.as_raw_fd(), &mut fs) },
        )?;
        after(ctx, scope, object, Step::AfterFsType)?;
        if !format(0, 1, true, || fs.f_type == 0x9123683e) {
            return Err(Failure::damage());
        }
        before(
            ctx,
            scope,
            object,
            Step::BeforeFsInfo,
            B::NativeFsinfo,
            1024,
            || unsafe { libc::ioctl(fd.as_raw_fd(), 0x8400941f as libc::c_ulong, &mut info) },
        )?;
        after(ctx, scope, object, Step::AfterFsInfo)?;
        if !format(16, 1, true, || info.fsid.iter().any(|b| *b != 0)) {
            return Err(Failure::damage());
        }
        before(
            ctx,
            scope,
            object,
            Step::BeforeHandle,
            B::NativeHandle,
            140,
            || unsafe {
                libc::syscall(
                    libc::SYS_name_to_handle_at,
                    fd.as_raw_fd(),
                    c"".as_ptr(),
                    &mut handle,
                    &mut mount,
                    libc::AT_EMPTY_PATH,
                ) as i32
            },
        )?;
        after(ctx, scope, object, Step::AfterHandle)?;
        if !format(0, 2, true, || handle.bytes == 20 && handle.kind == 77) {
            return Err(Failure::damage());
        }
        if !format(128, 1, true, || handle.data[..20].iter().any(|b| *b != 0)) {
            return Err(Failure::damage());
        }
        let mut raw = [0; 20];
        raw.copy_from_slice(&handle.data[..20]);
        Ok(Identity {
            fsid: info.fsid,
            handle: raw,
        })
    })();
    work::complete(B::IdentityAcquisitions, result.is_ok());
    if result.as_ref().is_err_and(|e| !e.observed) {
        work::update(|w| w.identity_refusals += 1)
    }
    result
}
const _: () = assert!(
    std::mem::size_of::<FsInfo>() == 1024
        && std::mem::size_of::<Handle>() == 136
        && std::mem::size_of::<Identity>() == 36
);
