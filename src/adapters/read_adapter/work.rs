//! Conservative reservations before entering the existing codec or Serde.
//! These are cumulative representation/work bounds, not an allocator or RSS guarantee.
use super::adapter_error::AdapterError;
use crate::application::read_budget::ReadWorkLimits;

// Small fixture profile: deliberately not the full P34 availability envelope.
pub(super) const REQUEST_BYTES: usize = 32 * 1024;
pub(super) const REPLY_FRAME_BYTES: usize = 32 * 1024;
// P34's page estimator reserves 64 KiB before any records. Its construction ceiling
// must exceed that floor even when the actual complete frame is much smaller.
pub(super) const BACKEND_REPLY_BYTES: usize = 128 * 1024;
pub(super) const OUTPUT_BYTES: usize = 128 * 1024;
pub(super) const OUTPUT_NODES: usize = 8192;
pub(super) const OUTPUT_ALLOCATION: usize = 16 * 1024 * 1024;

pub(super) struct Work {
    allocation: u64,
    units: u64,
    remaining: ReadWorkLimits,
}

impl Work {
    pub(super) fn try_new(remaining: ReadWorkLimits) -> Result<Self, AdapterError> {
        remaining.validate().map_err(|_| AdapterError::Limit)?;
        Ok(Self {
            allocation: 1536 * 1024 * 1024,
            units: 64 * 1024 * 1024,
            remaining,
        })
    }

    pub(super) fn remaining(&self) -> Result<ReadWorkLimits, AdapterError> {
        self.remaining.validate().map_err(|_| AdapterError::Limit)?;
        Ok(self.remaining)
    }

    pub(super) fn reserve(&mut self, allocation: u64, units: u64) -> Result<(), AdapterError> {
        self.allocation = self
            .allocation
            .checked_sub(allocation)
            .ok_or(AdapterError::Limit)?;
        self.units = self.units.checked_sub(units).ok_or(AdapterError::Limit)?;
        self.remaining.allocation_bytes = self
            .remaining
            .allocation_bytes
            .checked_sub(allocation)
            .ok_or(AdapterError::Limit)?;
        self.remaining.work_units = self
            .remaining
            .work_units
            .checked_sub(units)
            .ok_or(AdapterError::Limit)?;
        Ok(())
    }

    pub(super) fn request(&mut self, bytes: usize) -> Result<(), AdapterError> {
        if bytes > REQUEST_BYTES {
            return Err(AdapterError::Limit);
        }
        // The nonrecursive request schema has no arbitrary Value or buffered untagged
        // variants. Repeated elements are <= 1024 bytes (asserted beside the schema).
        // Each element consumes input; 32 slots per input byte cover Vec growth,
        // DTO + domain + packed request coexistence, and B-tree node/child arrays.
        // Map-only DTO entry adds a zero-sized visitor and a moved MapAccess wrapper,
        // not an allocation or second parse. One constant-size dispatch per record
        // fits the existing 512 work units per input byte (each record consumes bytes).
        // At most six named-record gates nest in this schema. Fixed 1 MiB covers
        // that stack scratch, root/cursor/struct construction and a 64 KiB call frame.
        self.reserve(1024 * 1024 + bytes as u64 * 32768, bytes as u64 * 512)
    }

    pub(super) fn reply(&mut self, bytes: usize) -> Result<(), AdapterError> {
        if bytes > REPLY_FRAME_BYTES {
            return Err(AdapterError::Limit);
        }
        // Strict codec scanning precedes Prost allocation. Bound its existing
        // wire::allocation_cost without writing another Protobuf parser:
        // - each nested message/field consumes >= 2 wire bytes; add one root;
        // - packed scalars may consume only ONE byte each, so reserve N more leaves;
        // - disjoint ID/Content payload lengths sum to <= N.
        // allocation_cost charges 4096/message, 256/field or packed scalar, plus
        // payload. Existing codec assertions bound containing stored wire/domain
        // objects; read wrappers are smaller (see response.rs). Multiplying by 16
        // covers wire+domain coexistence, Vec growth and complete 11-slot B-tree
        // nodes/child arrays. Scanner scratch is covered by the leaf-slot slack.
        // Depth <= 32 and collections <= 4096 are enforced by the strict codec.
        let n = bytes as u64;
        let objects = (n / 2 + 1) * 4096;
        let leaves = (n / 2 + n) * 256;
        self.reserve((objects + leaves + n) * 16, n * 512)
    }

    pub(super) fn output(&mut self) -> Result<(), AdapterError> {
        // Charge before constructing any Value. The projector then enforces
        // node/allocation limits before each allocation and counts exact compact
        // JSON bytes including keys, escaping, separators and the outer envelope.
        // Two complete byte buffers are reserved even though this API returns Value.
        self.reserve(
            (OUTPUT_ALLOCATION + OUTPUT_BYTES * 2) as u64,
            8 * 1024 * 1024,
        )
    }
}
