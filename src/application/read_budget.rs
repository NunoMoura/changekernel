//! Constituent and aggregate work reservations for one elementary read.
use super::read::ReadRefusal;

/// Caller-requested work ceilings. Every field must be positive and no larger than its
/// [`Default`] value; values only tighten this implementation's hard maxima. Allocation is
/// cumulative reserved allocation, not process RSS or an OS/global heap limit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ReadWorkLimits {
    /// Cumulative observed source lengths, including repeated witness reads; at most 64 MiB.
    pub source_bytes: u64,
    /// Aggregate reserved physical/native I/O for the call; at most 1 GiB.
    pub io_bytes: u64,
    /// Cumulative reserved allocation/representation traffic, not RSS; at most 2 GiB.
    pub allocation_bytes: u64,
    /// Reserved byte/node/native-loop work, not elapsed time; at most 2 Gi units.
    pub work_units: u64,
}
impl Default for ReadWorkLimits {
    fn default() -> Self {
        Self {
            source_bytes: 64 * 1024 * 1024,
            io_bytes: 1024 * 1024 * 1024,
            allocation_bytes: 2 * 1024 * 1024 * 1024,
            work_units: 2 * 1024 * 1024 * 1024,
        }
    }
}
impl ReadWorkLimits {
    pub(crate) fn validate(self) -> Result<(), ReadRefusal> {
        let max = Self::default();
        if self.source_bytes == 0
            || self.source_bytes > max.source_bytes
            || self.io_bytes == 0
            || self.io_bytes > max.io_bytes
            || self.allocation_bytes == 0
            || self.allocation_bytes > max.allocation_bytes
            || self.work_units == 0
            || self.work_units > max.work_units
        {
            return Err(ReadRefusal::Limit);
        }
        Ok(())
    }
}

pub(crate) struct ReadBudget {
    remaining: ReadWorkLimits,
    callbacks: u32,
}
impl ReadBudget {
    pub(crate) fn try_new(limits: ReadWorkLimits) -> Result<Self, ReadRefusal> {
        limits.validate()?;
        Ok(Self {
            remaining: limits,
            callbacks: 16,
        })
    }
    #[cfg(test)]
    pub(crate) fn remaining_for_test(&self) -> ReadWorkLimits {
        self.remaining
    }
    fn debit(counter: &mut u64, amount: u64) -> Result<(), ReadRefusal> {
        *counter = counter.checked_sub(amount).ok_or(ReadRefusal::Limit)?;
        Ok(())
    }
    pub(crate) fn source(&mut self, bytes: u64) -> Result<(), ReadRefusal> {
        Self::debit(&mut self.remaining.source_bytes, bytes)
    }
    pub(crate) fn io(&mut self, bytes: u64) -> Result<(), ReadRefusal> {
        Self::debit(&mut self.remaining.io_bytes, bytes)
    }
    pub(crate) fn allocate(&mut self, bytes: u64) -> Result<(), ReadRefusal> {
        Self::debit(&mut self.remaining.allocation_bytes, bytes)
    }
    pub(crate) fn work(&mut self, units: u64) -> Result<(), ReadRefusal> {
        Self::debit(&mut self.remaining.work_units, units)
    }
    pub(crate) fn callback(&mut self) -> Result<(), ReadRefusal> {
        self.callbacks = self.callbacks.checked_sub(1).ok_or(ReadRefusal::Limit)?;
        Ok(())
    }
}
