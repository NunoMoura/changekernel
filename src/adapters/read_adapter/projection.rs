//! Bounded construction of real JSON values, not Debug text or embedded protocol bytes.
use super::adapter_error::AdapterError;
use super::work;
use serde_json::{Map, Value};
use std::cell::Cell;
use std::io;

// Locally owned counters permit compositional field projection without cloning budgets.
// This private object is neither shared across threads nor exposed as an output value.
pub(super) struct Projection {
    bytes: Cell<usize>,
    nodes: Cell<usize>,
    allocation: Cell<usize>,
}
impl Projection {
    pub(super) fn new(maximum: usize) -> Self {
        Self {
            bytes: Cell::new(maximum.min(work::OUTPUT_BYTES)),
            nodes: Cell::new(work::OUTPUT_NODES),
            allocation: Cell::new(work::OUTPUT_ALLOCATION),
        }
    }
    fn debit(counter: &Cell<usize>, amount: usize) -> Result<(), AdapterError> {
        counter.set(
            counter
                .get()
                .checked_sub(amount)
                .ok_or(AdapterError::Limit)?,
        );
        Ok(())
    }
    fn charge(&self, bytes: usize, allocation: usize) -> Result<(), AdapterError> {
        Self::debit(&self.bytes, bytes)?;
        Self::debit(&self.nodes, 1)?;
        Self::debit(&self.allocation, allocation)?;
        Ok(())
    }
    pub(super) fn null(&self) -> Result<Value, AdapterError> {
        self.charge(4, 64)?;
        Ok(Value::Null)
    }
    #[cfg(test)]
    pub(super) fn boolean(&self, value: bool) -> Result<Value, AdapterError> {
        self.charge(if value { 4 } else { 5 }, 64)?;
        Ok(Value::Bool(value))
    }
    pub(super) fn small(&self, value: u32) -> Result<Value, AdapterError> {
        self.charge(digits(u64::from(value)), 64)?;
        Ok(Value::from(value))
    }
    pub(super) fn decimal(&self, value: u64) -> Result<Value, AdapterError> {
        let length = digits(value);
        self.charge(length + 2, length + 64)?;
        Ok(Value::String(value.to_string()))
    }
    pub(super) fn text(&self, value: &str) -> Result<Value, AdapterError> {
        // Ask the approved serializer to count escaping. No output buffer or custom
        // JSON escaper is used, and the sink refuses once the remaining ceiling is hit.
        let mut count = Count {
            bytes: 0,
            maximum: self.bytes.get(),
        };
        serde_json::to_writer(&mut count, value).map_err(|_| AdapterError::Limit)?;
        self.charge(
            count.bytes,
            value.len().checked_add(64).ok_or(AdapterError::Limit)?,
        )?;
        Ok(Value::String(value.to_owned()))
    }
    pub(super) fn hex(&self, bytes: &[u8]) -> Result<Value, AdapterError> {
        const DIGITS: &[u8; 16] = b"0123456789abcdef";
        let length = bytes.len().checked_mul(2).ok_or(AdapterError::Limit)?;
        self.charge(
            length.checked_add(2).ok_or(AdapterError::Limit)?,
            length.checked_add(64).ok_or(AdapterError::Limit)?,
        )?;
        let mut text = String::with_capacity(length);
        for &byte in bytes {
            text.push(char::from(DIGITS[usize::from(byte >> 4)]));
            text.push(char::from(DIGITS[usize::from(byte & 15)]));
        }
        Ok(Value::String(text))
    }
    pub(super) fn bytes(&self, bytes: &[u8]) -> Result<Value, AdapterError> {
        let (encoding, data) = match std::str::from_utf8(bytes) {
            Ok(text) => ("utf8", self.text(text)?),
            Err(_) => ("hex", self.hex(bytes)?),
        };
        self.object([("encoding", self.text(encoding)?), ("data", data)])
    }
    pub(super) fn object<const N: usize>(
        &self,
        fields: [(&'static str, Value); N],
    ) -> Result<Value, AdapterError> {
        // All keys are fixed ASCII field/tag names below, not user map keys. 2048
        // bytes per entry cover a whole B-tree node's slots/child array on insertion,
        // not merely the amortized entry size. Child allocations were charged already.
        let key_bytes = fields.iter().try_fold(0usize, |total, (key, _)| {
            total.checked_add(key.len() + 3).ok_or(AdapterError::Limit)
        })?;
        let bytes = 2 + N.saturating_sub(1) + key_bytes;
        self.charge(bytes, 64 + N * 2048 + key_bytes)?;
        let mut map = Map::new();
        for (key, value) in fields {
            if map.insert(key.to_owned(), value).is_some() {
                return Err(AdapterError::ReplyMismatch);
            }
        }
        Ok(Value::Object(map))
    }
    pub(super) fn array<T>(
        &self,
        values: impl ExactSizeIterator<Item = T>,
        mut project: impl FnMut(T) -> Result<Value, AdapterError>,
    ) -> Result<Value, AdapterError> {
        let length = values.len();
        if length > work::OUTPUT_NODES {
            return Err(AdapterError::Limit);
        }
        self.charge(2 + length.saturating_sub(1), 64 + length * 64)?;
        let mut result = Vec::with_capacity(length);
        for value in values {
            result.push(project(value)?);
        }
        Ok(Value::Array(result))
    }
    pub(super) fn optional<T>(
        &self,
        value: Option<&T>,
        project: impl FnOnce(&T) -> Result<Value, AdapterError>,
    ) -> Result<Value, AdapterError> {
        match value {
            Some(value) => project(value),
            None => self.null(),
        }
    }
}
fn digits(mut value: u64) -> usize {
    let mut count = 1;
    while value >= 10 {
        value /= 10;
        count += 1;
    }
    count
}
struct Count {
    bytes: usize,
    maximum: usize,
}
impl io::Write for Count {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        let next = self
            .bytes
            .checked_add(buffer.len())
            .filter(|n| *n <= self.maximum)
            .ok_or_else(|| io::Error::other("structured output limit exceeded"))?;
        self.bytes = next;
        Ok(buffer.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}
const _: () = assert!(std::mem::size_of::<Value>() <= 64);

#[cfg(test)]
#[path = "projection_tests.rs"]
mod tests;
