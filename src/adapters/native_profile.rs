//! Exact runtime checks for the externally built SQLite subject. No storage is opened here.
use std::collections::BTreeSet;

include!(concat!(env!("OUT_DIR"), "/native_expected.rs"));

pub const SQLITE_VERSION: &str = "3.54.1";
pub const SQLITE_VERSION_NUMBER: i32 = 3_054_001;
pub const SQLITE_SOURCE_ID: &str =
    "2026-10-16 14:45:20 555e07ef33f69a0957d24d8e555b702464a131d6f1607f4c3c1e4551e8e6ca76";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeProfile {
    pub version: String,
    pub version_number: i32,
    pub source_id: String,
    pub threadsafe: i32,
    pub compile_options: BTreeSet<String>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeProfileError {
    Unavailable,
    Version,
    Source,
    ThreadSafety,
    CompileOptions,
}
impl NativeProfile {
    /// Evidence validation, not authentication or permission to use a database.
    pub fn validate(&self) -> Result<(), NativeProfileError> {
        if self.version != SQLITE_VERSION || self.version_number != SQLITE_VERSION_NUMBER {
            return Err(NativeProfileError::Version);
        }
        if self.source_id != SQLITE_SOURCE_ID {
            return Err(NativeProfileError::Source);
        }
        if self.threadsafe != 1 {
            return Err(NativeProfileError::ThreadSafety);
        }
        let expected: BTreeSet<_> = VERIFIED_OPTIONS.iter().map(|s| (*s).to_owned()).collect();
        if self.compile_options != expected {
            return Err(NativeProfileError::CompileOptions);
        }
        Ok(())
    }
}
/// Inspect the actual linked engine, not caller-supplied labels. Call before future storage use.
pub fn verify_runtime() -> Result<NativeProfile, NativeProfileError> {
    let connection =
        rusqlite::Connection::open_in_memory().map_err(|_| NativeProfileError::Unavailable)?;
    let source_id = connection
        .query_row("SELECT sqlite_source_id()", [], |row| row.get(0))
        .map_err(|_| NativeProfileError::Unavailable)?;
    let mut statement = connection
        .prepare("PRAGMA compile_options")
        .map_err(|_| NativeProfileError::Unavailable)?;
    let compile_options = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|_| NativeProfileError::Unavailable)?
        .collect::<Result<_, _>>()
        .map_err(|_| NativeProfileError::Unavailable)?;
    let profile = NativeProfile {
        version: rusqlite::version().to_owned(),
        version_number: rusqlite::version_number(),
        source_id,
        // SAFETY: SQLite's no-argument, read-only compile-time configuration accessor.
        threadsafe: unsafe { libsqlite3_sys::sqlite3_threadsafe() },
        compile_options,
    };
    profile.validate()?;
    Ok(profile)
}
