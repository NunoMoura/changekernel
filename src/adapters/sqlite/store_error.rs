//! Storage refusals and uncertainty, distinct from application acceptance outcomes.
use crate::adapters::native_profile::NativeProfileError;
use crate::kernel::change::Error;
use std::fmt;
use std::io;

#[derive(Debug)]
pub enum StoreError {
    Io(io::Error),
    Busy,
    Custody,
    UnsupportedProfile,
    Corrupt,
    Limit,
    Database(rusqlite::Error),
    Refused(Error),
    Native(NativeProfileError),
    Fenced,
    Indeterminate,
    BlockedOrphan,
}
impl From<io::Error> for StoreError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}
impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Database(e)
    }
}
impl From<crate::application::read::ReadRefusal> for StoreError {
    fn from(error: crate::application::read::ReadRefusal) -> Self {
        use crate::application::read::ReadRefusal;
        match error {
            ReadRefusal::Limit => Self::Limit,
            ReadRefusal::Denied => Self::Refused(Error::Denied),
            ReadRefusal::Invalid => Self::Refused(Error::Invalid),
            ReadRefusal::Changed => Self::Custody,
            ReadRefusal::Unavailable => Self::Corrupt,
            ReadRefusal::Unsupported => Self::UnsupportedProfile,
        }
    }
}
impl From<Error> for StoreError {
    fn from(e: Error) -> Self {
        Self::Refused(e)
    }
}
impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(e) => write!(f, "storage I/O: {e}"),
            Self::Database(e) => write!(f, "database: {e}"),
            Self::Refused(e) => write!(f, "trusted boundary refused: {e:?}"),
            Self::Native(e) => write!(f, "native profile refused: {e:?}"),
            Self::Busy => f.write_str("another writer holds custody"),
            Self::Custody => f.write_str("native custody changed or invalid"),
            Self::UnsupportedProfile => f.write_str("unsupported profile"),
            Self::Corrupt => f.write_str("original frames or controls disagree"),
            Self::Limit => f.write_str("bounded descriptor limit"),
            Self::Fenced => f.write_str("handle fenced; reopen the same original"),
            Self::Indeterminate => f.write_str("outcome indeterminate"),
            Self::BlockedOrphan => {
                f.write_str("preserved unexplained allocation; replacement forbidden")
            }
        }
    }
}
impl std::error::Error for StoreError {}
pub type StoreResult<T> = std::result::Result<T, StoreError>;
