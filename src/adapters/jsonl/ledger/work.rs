//! Trusted-fixture logical observations. Not RSS, scanned bytes, or disk traffic.
//!
//! Construction units are whole owning domain/control/result aggregates: a
//! decode assembly (also when rejected), an independent source materialization
//! or clone, and a private result. Nested closed-schema fields belong to that
//! assembly; serialization is a separate emission, never a construction proxy.
//! Payload observes live participating allocation capacities, including ingress,
//! normalized grant paths/strings, partial visitors, syscall names/inventory,
//! read buffers and successful or failed emission buffers. Object/visitor/hash
//! headers, selected local bindings and live descriptor handles are separate
//! observations, not claims about complete native stack frames or process RSS.
use std::{
    cell::RefCell,
    ops::{Deref, DerefMut},
};
#[derive(Clone, Copy, Debug, Default)]
pub struct LedgerBoundary {
    pub attempts: u64,
    pub completions: u64,
    pub matches: u64,
    pub no_matches: u64,
    pub operand_bytes: u64,
    pub schema_words: u64,
}
#[derive(Clone, Copy, Debug, Default)]
pub struct LedgerWork {
    pub shared_passes: u64,
    pub member_passes: u64,
    pub reads: LedgerBoundary,
    pub buffered_bytes: u64,
    pub trace_bytes: u64,
    pub accepted_hash_bytes: u64,
    pub candidate_hash_bytes: u64,
    pub ingress: LedgerBoundary,
    pub controls: LedgerBoundary,
    pub origins: LedgerBoundary,
    pub constructions: LedgerBoundary,
    pub emissions: LedgerBoundary,
    pub control_emissions: LedgerBoundary,
    pub origin_emissions: LedgerBoundary,
    pub input_emissions: LedgerBoundary,
    pub candidate_emissions: LedgerBoundary,
    pub reply_emissions: LedgerBoundary,
    pub records_peak: u64,
    pub metadata_vectors_peak: u64,
    pub accepted_vectors_peak: u64,
    pub metadata_entries_peak: u64,
    pub accepted_entries_peak: u64,
    pub grant_vectors_peak: u64,
    pub descriptor_handles_peak: u64,
    pub stack_bindings_peak: u64,
    pub canonical: LedgerBoundary,
    pub semantic: LedgerBoundary,
    pub typed_input: LedgerBoundary,
    pub relationships: LedgerBoundary,
    pub identifiers: LedgerBoundary,
    pub ordering: LedgerBoundary,
    pub fields: LedgerBoundary,
    pub cleanup: LedgerBoundary,
    pub retention: LedgerBoundary,
    pub outputs: LedgerBoundary,
    pub errors: LedgerBoundary,
    pub inventory_visits: u64,
    pub inventory_buffer_peak: u64,
    pub named_payload_peak: u64,
    /// Logical size_of headers/masks of tracked named objects, not RSS or the complete native stack.
    pub named_fixed_bytes_peak: u64,
    pub hash_state_bytes_peak: u64,
    pub trace_buffers_peak: u64,
    pub trace_capacity_peak: u64,
    pub accounting_updates: u64,
}
#[derive(Clone, Copy)]
pub(super) enum Boundary {
    Reads,
    Ingress,
    Controls,
    Origins,
    Constructions,
    Emissions,
    ControlEmissions,
    OriginEmissions,
    InputEmissions,
    CandidateEmissions,
    ReplyEmissions,
    Canonical,
    Semantic,
    TypedInput,
    Relationships,
    Identifiers,
    Ordering,
    Fields,
    Cleanup,
    Retention,
    Outputs,
    Errors,
}
#[derive(Default)]
struct Active {
    work: LedgerWork,
    live: usize,
    fixed: usize,
    traces: usize,
    trace_capacity: usize,
    epoch: u64,
    records: usize,
    metadata: usize,
    accepted: usize,
    descriptors: usize,
    stack: usize,
}
thread_local! { static ACTIVE:RefCell<Active> = RefCell::new(Active::default()); }
impl LedgerWork {
    /// Includes failed connection calls before an owning host exists and discarded responses.
    pub fn last_call() -> Self {
        ACTIVE.with(|a| a.borrow().work)
    }
}
pub(super) fn begin(ingress: usize) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        let epoch = a.epoch + 1;
        *a = Active::default();
        a.epoch = epoch;
        a.live = ingress;
        a.work.named_payload_peak = ingress as u64;
    });
}
fn boundary(w: &mut LedgerWork, b: Boundary) -> &mut LedgerBoundary {
    match b {
        Boundary::Reads => &mut w.reads,
        Boundary::Ingress => &mut w.ingress,
        Boundary::Controls => &mut w.controls,
        Boundary::Origins => &mut w.origins,
        Boundary::Constructions => &mut w.constructions,
        Boundary::Emissions => &mut w.emissions,
        Boundary::ControlEmissions => &mut w.control_emissions,
        Boundary::OriginEmissions => &mut w.origin_emissions,
        Boundary::InputEmissions => &mut w.input_emissions,
        Boundary::CandidateEmissions => &mut w.candidate_emissions,
        Boundary::ReplyEmissions => &mut w.reply_emissions,
        Boundary::Canonical => &mut w.canonical,
        Boundary::Semantic => &mut w.semantic,
        Boundary::TypedInput => &mut w.typed_input,
        Boundary::Relationships => &mut w.relationships,
        Boundary::Identifiers => &mut w.identifiers,
        Boundary::Ordering => &mut w.ordering,
        Boundary::Fields => &mut w.fields,
        Boundary::Cleanup => &mut w.cleanup,
        Boundary::Retention => &mut w.retention,
        Boundary::Outputs => &mut w.outputs,
        Boundary::Errors => &mut w.errors,
    }
}
pub(super) fn attempt(b: Boundary, bytes: usize, words: usize) {
    ACTIVE.with(|a| {
        let w = &mut a.borrow_mut().work;
        let x = boundary(w, b);
        x.attempts += 1;
        x.operand_bytes += bytes as u64;
        x.schema_words += words as u64;
        w.accounting_updates += 3;
    });
}
pub(super) fn complete(b: Boundary, ok: bool) {
    ACTIVE.with(|a| {
        let w = &mut a.borrow_mut().work;
        let x = boundary(w, b);
        x.completions += 1;
        if ok {
            x.matches += 1
        } else {
            x.no_matches += 1
        };
        w.accounting_updates += 2;
    });
}
pub(super) fn test(b: Boundary, bytes: usize, words: usize, f: impl FnOnce() -> bool) -> bool {
    attempt(b, bytes, words);
    let ok = f();
    complete(b, ok);
    ok
}
pub(super) fn update(f: impl FnOnce(&mut LedgerWork)) {
    ACTIVE.with(|a| {
        let w = &mut a.borrow_mut().work;
        f(w);
        w.accounting_updates += 1;
    });
}
#[derive(Clone, Copy)]
pub(crate) enum Role {
    Plain,
    Record,
    Metadata(usize),
    Accepted(usize),
}
pub(crate) trait Heap {
    fn role(&self) -> Role {
        Role::Plain
    }
    fn vector_role(_: usize) -> Role {
        Role::Plain
    }
    fn heap(&self) -> usize;
    fn logical(&self) -> usize {
        self.heap()
    }
}
impl Heap for String {
    fn logical(&self) -> usize {
        self.len()
    }
    fn heap(&self) -> usize {
        self.capacity()
    }
}
impl Heap for std::ffi::CString {
    fn heap(&self) -> usize {
        self.as_bytes_with_nul().len()
    }
}
impl Heap for std::path::PathBuf {
    fn heap(&self) -> usize {
        self.capacity()
    }
    fn logical(&self) -> usize {
        self.as_os_str().len()
    }
}
impl Heap for u64 {
    fn heap(&self) -> usize {
        0
    }
}
impl Heap for bool {
    fn heap(&self) -> usize {
        0
    }
}
impl<T: Heap> Heap for Option<T> {
    fn logical(&self) -> usize {
        self.as_ref().map_or(0, Heap::logical)
    }
    fn heap(&self) -> usize {
        self.as_ref().map_or(0, Heap::heap)
    }
}
impl<T: Heap> Heap for Vec<T> {
    fn role(&self) -> Role {
        T::vector_role(self.len())
    }
    fn logical(&self) -> usize {
        self.iter().map(Heap::logical).sum()
    }
    fn heap(&self) -> usize {
        self.capacity() * std::mem::size_of::<T>() + self.iter().map(Heap::heap).sum::<usize>()
    }
}
impl Heap for u8 {
    fn heap(&self) -> usize {
        0
    }
}
impl<T: Heap, const N: usize> Heap for [T; N] {
    fn logical(&self) -> usize {
        self.iter().map(Heap::logical).sum()
    }
    fn heap(&self) -> usize {
        self.iter().map(Heap::heap).sum()
    }
}
pub(crate) struct Owned<T: Heap> {
    value: Option<T>,
    bytes: usize,
    trace: bool,
    epoch: u64,
    role: Role,
}
impl<T: Heap> Owned<T> {
    pub fn rebase(&mut self) {
        ACTIVE.with(|a| self.epoch = a.borrow().epoch);
    }
    pub fn constructed(f: impl FnOnce() -> T) -> Self {
        attempt(Boundary::Constructions, 0, 1);
        let value = Self::new(f());
        complete(Boundary::Constructions, true);
        value
    }
    pub fn try_constructed<E>(f: impl FnOnce() -> Result<T, E>) -> Result<Self, E> {
        attempt(Boundary::Constructions, 0, 1);
        let value = Self::new(f()?);
        complete(Boundary::Constructions, true);
        Ok(value)
    }
    pub fn refresh(&mut self) {
        let bytes = self.value.as_ref().unwrap().heap();
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.live = a.live.saturating_sub(self.bytes) + bytes;
            a.work.accounting_updates += 2;
            a.work.named_payload_peak = a.work.named_payload_peak.max(a.live as u64);
        });
        self.bytes = bytes;
        role_resize(self.value.as_ref().unwrap().role());
    }
    pub fn into_inner(mut self) -> T {
        self.value.take().unwrap()
    }
    pub fn new(value: T) -> Self {
        Self::with_trace(value, false)
    }
    pub fn with_trace(value: T, trace: bool) -> Self {
        let bytes = value.heap();
        let role = value.role();
        let epoch = ACTIVE.with(|a| a.borrow().epoch);
        role_add(role);
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.live += bytes;
            a.fixed += std::mem::size_of::<Self>();
            a.work.named_fixed_bytes_peak = a.work.named_fixed_bytes_peak.max(a.fixed as u64);
            a.work.accounting_updates += 4;
            a.work.named_payload_peak = a.work.named_payload_peak.max(a.live as u64);
            if trace {
                a.traces += 1;
                a.trace_capacity += bytes;
                a.work.accounting_updates += 4;
                a.work.trace_buffers_peak = a.work.trace_buffers_peak.max(a.traces as u64);
                a.work.trace_capacity_peak =
                    a.work.trace_capacity_peak.max(a.trace_capacity as u64);
            }
        });
        Self {
            value: Some(value),
            bytes,
            trace,
            epoch,
            role,
        }
    }
}
impl<T: Heap> Deref for Owned<T> {
    type Target = T;
    fn deref(&self) -> &T {
        self.value.as_ref().unwrap()
    }
}
impl<T: Heap> DerefMut for Owned<T> {
    fn deref_mut(&mut self) -> &mut T {
        self.value.as_mut().unwrap()
    }
}
impl<T: Heap> Drop for Owned<T> {
    fn drop(&mut self) {
        if ACTIVE.with(|a| a.borrow().epoch) != self.epoch {
            return;
        }
        role_drop(self.role);
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.live = a.live.saturating_sub(self.bytes);
            a.fixed = a.fixed.saturating_sub(std::mem::size_of::<Self>());
            a.work.accounting_updates += 2;
            if self.trace {
                a.traces = a.traces.saturating_sub(1);
                a.work.accounting_updates += 2;
                a.trace_capacity = a.trace_capacity.saturating_sub(self.bytes);
            }
        });
    }
}

pub(super) fn buffered_capacity(bytes: usize, trace: bool) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        a.work.accounting_updates += 1 + if trace && bytes > 0 { 2 } else { 0 };
        a.work.named_payload_peak = a.work.named_payload_peak.max((a.live + bytes) as u64);
        if trace && bytes > 0 {
            a.work.trace_buffers_peak = a.work.trace_buffers_peak.max((a.traces + 1) as u64);
            a.work.trace_capacity_peak = a
                .work
                .trace_capacity_peak
                .max((a.trace_capacity + bytes) as u64);
        }
    });
}

pub(super) struct Fixed(pub usize);
impl Fixed {
    pub fn new(bytes: usize) -> Self {
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.fixed += bytes;
            a.stack += 1;
            a.work.stack_bindings_peak = a.work.stack_bindings_peak.max(a.stack as u64);
            a.work.named_fixed_bytes_peak = a.work.named_fixed_bytes_peak.max(a.fixed as u64);
            a.work.accounting_updates += 2;
        });
        Self(bytes)
    }
}
impl Drop for Fixed {
    fn drop(&mut self) {
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.fixed = a.fixed.saturating_sub(self.0);
            a.stack -= 1;
            a.work.accounting_updates += 1;
        });
    }
}
pub(super) fn fixed_baseline(bytes: usize) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        a.fixed += bytes;
        a.work.named_fixed_bytes_peak = a.work.named_fixed_bytes_peak.max(a.fixed as u64);
        a.work.accounting_updates += 2;
    });
}

impl<T: Heap> Heap for Owned<T> {
    fn heap(&self) -> usize {
        self.value.as_ref().unwrap().heap()
    }
    fn logical(&self) -> usize {
        self.value.as_ref().unwrap().logical()
    }
}

fn role_add(r: Role) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        match r {
            Role::Record => {
                a.records += 1;
                a.work.records_peak = a.work.records_peak.max(a.records as u64)
            }
            Role::Metadata(n) => {
                a.metadata += 1;
                a.work.metadata_vectors_peak = a.work.metadata_vectors_peak.max(a.metadata as u64);
                a.work.metadata_entries_peak = a.work.metadata_entries_peak.max(n as u64)
            }
            Role::Accepted(n) => {
                a.accepted += 1;
                a.work.accepted_vectors_peak = a.work.accepted_vectors_peak.max(a.accepted as u64);
                a.work.accepted_entries_peak = a.work.accepted_entries_peak.max(n as u64)
            }
            Role::Plain => (),
        }
    });
}
fn role_drop(r: Role) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        match r {
            Role::Record => a.records -= 1,
            Role::Metadata(_) => a.metadata -= 1,
            Role::Accepted(_) => a.accepted -= 1,
            Role::Plain => (),
        }
    });
}
fn role_resize(r: Role) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        match r {
            Role::Metadata(n) => {
                a.work.metadata_entries_peak = a.work.metadata_entries_peak.max(n as u64)
            }
            Role::Accepted(n) => {
                a.work.accepted_entries_peak = a.work.accepted_entries_peak.max(n as u64)
            }
            _ => (),
        }
    });
}
pub(super) struct Allocation {
    bytes: std::cell::Cell<usize>,
    trace: bool,
    epoch: u64,
}
impl Allocation {
    pub fn new(trace: bool) -> Self {
        Self {
            bytes: std::cell::Cell::new(0),
            trace,
            epoch: ACTIVE.with(|a| a.borrow().epoch),
        }
    }
    pub fn resize(&self, n: usize) {
        let old = self.bytes.replace(n);
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.live = a.live - old + n;
            a.work.named_payload_peak = a.work.named_payload_peak.max(a.live as u64);
            a.work.accounting_updates += 2;
            if self.trace {
                if old == 0 && n > 0 {
                    a.traces += 1
                }
                if old > 0 && n == 0 {
                    a.traces -= 1
                }
                a.trace_capacity = a.trace_capacity - old + n;
                a.work.trace_buffers_peak = a.work.trace_buffers_peak.max(a.traces as u64);
                a.work.trace_capacity_peak =
                    a.work.trace_capacity_peak.max(a.trace_capacity as u64);
                a.work.accounting_updates += 4;
            }
        });
    }
    pub fn adopt(self, value: Vec<u8>) -> Owned<Vec<u8>> {
        let bytes = self.bytes.replace(0);
        assert_eq!(bytes, value.capacity());
        let epoch = self.epoch;
        let trace = self.trace;
        ACTIVE.with(|a| {
            let mut a = a.borrow_mut();
            a.fixed += std::mem::size_of::<Owned<Vec<u8>>>();
            a.work.named_fixed_bytes_peak = a.work.named_fixed_bytes_peak.max(a.fixed as u64);
        });
        Owned {
            value: Some(value),
            bytes,
            trace,
            epoch,
            role: Role::Plain,
        }
    }
}
impl Drop for Allocation {
    fn drop(&mut self) {
        if self.bytes.get() > 0 {
            self.resize(0);
        }
    }
}
pub(super) fn descriptors(delta: isize) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        a.descriptors = a
            .descriptors
            .checked_add_signed(delta)
            .expect("descriptor accounting");
        a.work.descriptor_handles_peak = a.work.descriptor_handles_peak.max(a.descriptors as u64);
        a.work.accounting_updates += 2;
    });
}
pub(super) fn descriptor_baseline(n: usize) {
    ACTIVE.with(|a| {
        let mut a = a.borrow_mut();
        a.descriptors = n;
        a.work.descriptor_handles_peak = n as u64;
        a.work.grant_vectors_peak = 1;
    });
}

pub(super) fn epoch() -> u64 {
    ACTIVE.with(|a| a.borrow().epoch)
}
