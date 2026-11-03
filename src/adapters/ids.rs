//! Explicit OS-secure candidates. Callers retain typed requests before submission.
//! This allocates no domain identity, journal, clock/counter fallback or retry ID.
use std::io;

const ZERO_ATTEMPTS: usize = 4;

/// Raw nonzero 128-bit candidate from initialized Linux OS randomness.
/// Uniqueness is checked in the relevant acceptance namespace: Change-local entity/content
/// claims or Ledger inclusion. Randomness alone never proves uniqueness.
pub fn candidate() -> io::Result<[u8; 16]> {
    sample(fill_os)
}

fn sample(mut fill: impl FnMut(&mut [u8; 16]) -> io::Result<()>) -> io::Result<[u8; 16]> {
    for _ in 0..ZERO_ATTEMPTS {
        let mut bytes = [0; 16];
        fill(&mut bytes)?;
        if bytes != [0; 16] {
            return Ok(bytes);
        }
    }
    Err(io::Error::other(
        "OS randomness returned only zero candidates",
    ))
}

#[cfg(target_os = "linux")]
fn fill_os(bytes: &mut [u8; 16]) -> io::Result<()> {
    unsafe extern "C" {
        fn getrandom(buffer: *mut std::ffi::c_void, length: usize, flags: u32) -> isize;
    }
    let mut offset = 0;
    // Positive partial results can require at most 16 calls. flags=0 waits for OS
    // initialization; never use GRND_INSECURE, /dev/urandom, clock or counter fallback.
    while offset < bytes.len() {
        // SAFETY: the writable slice points to length bytes for this blocking OS call.
        let read =
            unsafe { getrandom(bytes[offset..].as_mut_ptr().cast(), bytes.len() - offset, 0) };
        if read < 0 {
            return Err(io::Error::last_os_error());
        }
        let read = usize::try_from(read).map_err(|_| io::Error::other("invalid entropy count"))?;
        if read == 0 || read > bytes.len() - offset {
            return Err(io::Error::other("incomplete OS entropy"));
        }
        offset += read;
    }
    Ok(())
}
#[cfg(not(target_os = "linux"))]
fn fill_os(_: &mut [u8; 16]) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "OS ID profile is Linux-only",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn zero_resampling_is_bounded_and_can_recover_without_implicit_request_regeneration() {
        let mut calls = 0;
        let bytes = super::sample(|out| {
            calls += 1;
            if calls == 2 {
                out[15] = 7;
            }
            Ok(())
        })
        .unwrap();
        assert_eq!(calls, 2);
        assert_eq!(bytes[15], 7);
        calls = 0;
        assert!(super::sample(|_| {
            calls += 1;
            Ok(())
        })
        .is_err());
        assert_eq!(calls, ZERO_ATTEMPTS);
    }
    #[test]
    fn entropy_failure_is_not_retried_or_replaced_with_a_fallback() {
        let mut calls = 0;
        let error = super::sample(|_| {
            calls += 1;
            Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "denied OS source",
            ))
        })
        .unwrap_err();
        assert_eq!(calls, 1);
        assert_eq!(error.kind(), io::ErrorKind::PermissionDenied);
    }
}
