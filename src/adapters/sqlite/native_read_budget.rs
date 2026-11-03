//! Scoped native VM/length limits for verification reads; never a global heap/acceptance cap.
use super::store_error::{StoreError, StoreResult};
use crate::application::read_budget::ReadBudget;
use rusqlite::limits::Limit;
use rusqlite::Connection;
use std::cell::Cell;
use std::ffi::{c_int, c_void};

// Technical justification: the safe rusqlite progress-handler API requires a feature that is
// not selected in the approved native profile. Enabling it is out of scope. The existing FFI
// is used only to install/remove one synchronous callback on an exclusively borrowed connection.
// This bounds VM dispatch only. cold_read requires native_read_shape's input, loop, I/O and
// cumulative-allocation reservations BEFORE native opening; this guard is not a substitute.
pub(super) struct NativeReadBudget<'connection> {
    connection: &'connection Connection,
    remaining: Box<Cell<u64>>,
    limits: Vec<(Limit, i32)>,
}
unsafe extern "C" fn progress(context: *mut c_void) -> c_int {
    // SAFETY: installation retains the boxed Cell at this stable address until removal in
    // Drop. SQLite invokes this synchronously, with no reentry, while the connection is used
    // on its owning thread. The callback neither panics nor calls SQLite or user code.
    let remaining = unsafe { &*context.cast::<Cell<u64>>() };
    match remaining.get() {
        0 => 1,
        n => {
            remaining.set(n - 1);
            0
        }
    }
}
impl<'connection> NativeReadBudget<'connection> {
    pub fn for_call(
        connection: &'connection Connection,
        budget: &mut ReadBudget,
    ) -> StoreResult<Self> {
        budget.work(2_000_000)?;
        budget.allocate(1024)?;
        Self::try_new(connection)
    }
    pub fn reapply(&self) -> StoreResult<()> {
        for (limit, value) in [
            (Limit::SQLITE_LIMIT_LENGTH, 16 * 1024 * 1024 + 65536),
            (Limit::SQLITE_LIMIT_SQL_LENGTH, 4096),
        ] {
            self.connection.set_limit(limit, value)?;
        }
        Ok(())
    }
    pub fn try_new(connection: &'connection Connection) -> StoreResult<Self> {
        let mut out = Self {
            connection,
            remaining: Box::new(Cell::new(2_000_000)),
            limits: Vec::new(),
        };
        for (limit, value) in [
            (Limit::SQLITE_LIMIT_LENGTH, 16 * 1024 * 1024 + 65536),
            (Limit::SQLITE_LIMIT_SQL_LENGTH, 4096),
            (Limit::SQLITE_LIMIT_VDBE_OP, 65536),
            (Limit::SQLITE_LIMIT_EXPR_DEPTH, 32),
            (Limit::SQLITE_LIMIT_COLUMN, 64),
        ] {
            let previous = connection.set_limit(limit, value)?;
            out.limits.push((limit, previous));
        }
        // SAFETY: this private connection has no other progress callback. The Box address
        // stays stable if the guard moves; Drop removes the callback before freeing it.
        // Connection outlives this guard, and the guard never escapes the synchronous read.
        unsafe {
            libsqlite3_sys::sqlite3_progress_handler(
                connection.handle(),
                1,
                Some(progress),
                (&*out.remaining as *const Cell<u64>).cast_mut().cast(),
            );
        }
        Ok(out)
    }
    pub fn exhausted(&self) -> bool {
        self.remaining.get() == 0
    }
}
impl Drop for NativeReadBudget<'_> {
    fn drop(&mut self) {
        // SAFETY: still-live, exclusively used connection; removal happens before Box drop.
        unsafe {
            libsqlite3_sys::sqlite3_progress_handler(
                self.connection.handle(),
                0,
                None,
                std::ptr::null_mut(),
            );
        }
        for (limit, previous) in &self.limits {
            let _ = self.connection.set_limit(*limit, *previous);
        }
    }
}

pub(super) fn classify<T>(budget: &NativeReadBudget<'_>, result: StoreResult<T>) -> StoreResult<T> {
    if budget.exhausted() {
        Err(StoreError::Limit)
    } else {
        result
    }
}
