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
#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct Measures {
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
    pub records: LedgerBoundary,
    pub record_emissions: LedgerBoundary,
    pub grant_admission: LedgerBoundary,
    pub input_admission: LedgerBoundary,
    pub permissions: LedgerBoundary,
    pub principals: LedgerBoundary,
    pub key_uniqueness: LedgerBoundary,
    pub key_lookup: LedgerBoundary,
    pub key_feasibility: LedgerBoundary,
    pub evaluator_calculations: LedgerBoundary,
    pub projection: LedgerBoundary,
    pub applicability: LedgerBoundary,
    pub supplied_input_bytes: u64,
    pub supplied_input_capacity: u64,
    pub permission_denied: u64,
    pub permission_unavailable: u64,
    pub check_attempts: u64,
    pub check_acceptances: u64,
    pub copied_record_bytes: u64,
    pub span_entries_peak: u64,
    pub key_entries_peak: u64,
    pub assessment_entries_peak: u64,
    pub identity_acquisitions: LedgerBoundary,
    pub native_fstype: LedgerBoundary,
    pub native_fsinfo: LedgerBoundary,
    pub native_handle: LedgerBoundary,
    pub identity_format: LedgerBoundary,
    pub identity_comparisons: LedgerBoundary,
    pub native_buffer_bytes: u64,
    pub identity_raw_operand_bytes: u64,
    pub identity_text_operand_bytes: u64,
    pub identity_scratch_bytes_peak: u64,
    pub identity_io_failures: u64,
    pub identity_refusals: u64,
}
#[derive(Clone, Copy)]
pub(crate) enum Boundary {
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
    GrantAdmission,
    InputAdmission,
    Permissions,
    Principals,
    KeyUniqueness,
    KeyLookup,
    KeyFeasibility,
    EvaluatorCalculations,
    Projection,
    Applicability,
    IdentityAcquisitions,
    NativeFstype,
    NativeFsinfo,
    NativeHandle,
    IdentityFormat,
    IdentityComparisons,
}
#[derive(Default)]
struct Active {
    work: Measures,
    call: Option<super::history::LedgerHistoryCall>,
    continuity_call: Option<super::continuity::LedgerContinuityCall>,
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
thread_local! {
    static CONTINUITY_ACTIVE: RefCell<Active> = RefCell::new(Active::default());
    static CONTINUITY_LAST: std::cell::Cell<super::continuity::LedgerContinuityWork> = std::cell::Cell::new(super::continuity::LedgerContinuityWork::default());
    static CONTINUITY_MODE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    static LEGACY_ACTIVE: RefCell<Active> = RefCell::new(Active::default());
    static HISTORY_ACTIVE: RefCell<Active> = RefCell::new(Active::default());
    static HISTORY_LAST: std::cell::Cell<super::history::LedgerHistoryWork> = std::cell::Cell::new(super::history::LedgerHistoryWork::default());
    static HISTORY_MODE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
    static NEXT_EPOCH: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
}
fn active<R>(f: impl FnOnce(&RefCell<Active>) -> R) -> R {
    if CONTINUITY_MODE.get() {
        CONTINUITY_ACTIVE.with(f)
    } else if HISTORY_MODE.get() {
        HISTORY_ACTIVE.with(f)
    } else {
        LEGACY_ACTIVE.with(f)
    }
}
impl LedgerWork {
    /// Includes failed connection calls before an owning host exists and discarded responses.
    pub fn last_call() -> Self {
        LEGACY_ACTIVE.with(|a| {
            let a = a.borrow();
            LedgerWork {
                shared_passes: a.work.shared_passes,
                member_passes: a.work.member_passes,
                reads: a.work.reads,
                buffered_bytes: a.work.buffered_bytes,
                trace_bytes: a.work.trace_bytes,
                accepted_hash_bytes: a.work.accepted_hash_bytes,
                candidate_hash_bytes: a.work.candidate_hash_bytes,
                ingress: a.work.ingress,
                controls: a.work.controls,
                origins: a.work.origins,
                constructions: a.work.constructions,
                emissions: a.work.emissions,
                control_emissions: a.work.control_emissions,
                origin_emissions: a.work.origin_emissions,
                input_emissions: a.work.input_emissions,
                candidate_emissions: a.work.candidate_emissions,
                reply_emissions: a.work.reply_emissions,
                records_peak: a.work.records_peak,
                metadata_vectors_peak: a.work.metadata_vectors_peak,
                accepted_vectors_peak: a.work.accepted_vectors_peak,
                metadata_entries_peak: a.work.metadata_entries_peak,
                accepted_entries_peak: a.work.accepted_entries_peak,
                grant_vectors_peak: a.work.grant_vectors_peak,
                descriptor_handles_peak: a.work.descriptor_handles_peak,
                stack_bindings_peak: a.work.stack_bindings_peak,
                canonical: a.work.canonical,
                semantic: a.work.semantic,
                typed_input: a.work.typed_input,
                relationships: a.work.relationships,
                identifiers: a.work.identifiers,
                ordering: a.work.ordering,
                fields: a.work.fields,
                cleanup: a.work.cleanup,
                retention: a.work.retention,
                outputs: a.work.outputs,
                errors: a.work.errors,
                inventory_visits: a.work.inventory_visits,
                inventory_buffer_peak: a.work.inventory_buffer_peak,
                named_payload_peak: a.work.named_payload_peak,
                named_fixed_bytes_peak: a.work.named_fixed_bytes_peak,
                hash_state_bytes_peak: a.work.hash_state_bytes_peak,
                trace_buffers_peak: a.work.trace_buffers_peak,
                trace_capacity_peak: a.work.trace_capacity_peak,
                accounting_updates: a.work.accounting_updates,
            }
        })
    }
}
pub(crate) fn begin(ingress: usize) {
    CONTINUITY_MODE.set(false);
    HISTORY_MODE.set(false);
    reset(ingress);
}
fn reset(ingress: usize) {
    active(|a| {
        let mut a = a.borrow_mut();
        let epoch = NEXT_EPOCH.get() + 1;
        NEXT_EPOCH.set(epoch);
        *a = Active::default();
        a.epoch = epoch;
        a.live = ingress;
        a.work.named_payload_peak = ingress as u64;
    });
}
fn boundary(w: &mut Measures, b: Boundary) -> &mut LedgerBoundary {
    match b {
        Boundary::Reads => &mut w.reads,
        Boundary::Ingress => &mut w.ingress,
        Boundary::Controls => &mut w.controls,
        Boundary::Origins => {
            if history_mode() {
                &mut w.records
            } else {
                &mut w.origins
            }
        }
        Boundary::Constructions => &mut w.constructions,
        Boundary::Emissions => &mut w.emissions,
        Boundary::ControlEmissions => &mut w.control_emissions,
        Boundary::OriginEmissions => {
            if history_mode() {
                &mut w.record_emissions
            } else {
                &mut w.origin_emissions
            }
        }
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
        Boundary::GrantAdmission => &mut w.grant_admission,
        Boundary::InputAdmission => &mut w.input_admission,
        Boundary::Permissions => &mut w.permissions,
        Boundary::Principals => &mut w.principals,
        Boundary::KeyUniqueness => &mut w.key_uniqueness,
        Boundary::KeyLookup => &mut w.key_lookup,
        Boundary::KeyFeasibility => &mut w.key_feasibility,
        Boundary::EvaluatorCalculations => &mut w.evaluator_calculations,
        Boundary::Projection => &mut w.projection,
        Boundary::Applicability => &mut w.applicability,
        Boundary::IdentityAcquisitions => &mut w.identity_acquisitions,
        Boundary::NativeFstype => &mut w.native_fstype,
        Boundary::NativeFsinfo => &mut w.native_fsinfo,
        Boundary::NativeHandle => &mut w.native_handle,
        Boundary::IdentityFormat => &mut w.identity_format,
        Boundary::IdentityComparisons => &mut w.identity_comparisons,
    }
}
pub(crate) fn attempt(b: Boundary, bytes: usize, words: usize) {
    active(|a| {
        let w = &mut a.borrow_mut().work;
        let x = boundary(w, b);
        x.attempts += 1;
        x.operand_bytes += bytes as u64;
        x.schema_words += words as u64;
        w.accounting_updates += 3;
    });
}
pub(crate) fn complete(b: Boundary, ok: bool) {
    active(|a| {
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
pub(crate) fn test(b: Boundary, bytes: usize, words: usize, f: impl FnOnce() -> bool) -> bool {
    attempt(b, bytes, words);
    let ok = f();
    complete(b, ok);
    ok
}
pub(crate) fn update(f: impl FnOnce(&mut Measures)) {
    active(|a| {
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
        active(|a| self.epoch = a.borrow().epoch);
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
        active(|a| {
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
    pub fn from_baseline(value: T) -> Self {
        Self::adopt(value, false, true)
    }
    pub fn with_trace(value: T, trace: bool) -> Self {
        Self::adopt(value, trace, false)
    }
    fn adopt(value: T, trace: bool, accounted: bool) -> Self {
        let bytes = value.heap();
        let role = value.role();
        let epoch = active(|a| a.borrow().epoch);
        role_add(role);
        active(|a| {
            let mut a = a.borrow_mut();
            if !accounted {
                a.live += bytes;
            }
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
        if active(|a| a.borrow().epoch) != self.epoch {
            return;
        }
        role_drop(self.role);
        active(|a| {
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

pub(crate) fn buffered_capacity(bytes: usize, trace: bool) {
    active(|a| {
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

pub(crate) struct Fixed(pub usize);
impl Fixed {
    pub fn new(bytes: usize) -> Self {
        active(|a| {
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
        active(|a| {
            let mut a = a.borrow_mut();
            a.fixed = a.fixed.saturating_sub(self.0);
            a.stack -= 1;
            a.work.accounting_updates += 1;
        });
    }
}
pub(crate) fn fixed_baseline(bytes: usize) {
    active(|a| {
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
    active(|a| {
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
    active(|a| {
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
    active(|a| {
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
pub(crate) struct Allocation {
    bytes: std::cell::Cell<usize>,
    trace: bool,
    epoch: u64,
}
impl Allocation {
    pub fn new(trace: bool) -> Self {
        Self {
            bytes: std::cell::Cell::new(0),
            trace,
            epoch: active(|a| a.borrow().epoch),
        }
    }
    pub fn resize(&self, n: usize) {
        let old = self.bytes.replace(n);
        active(|a| {
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
    pub fn adopt<T: Heap>(self, value: T) -> Owned<T> {
        let bytes = self.bytes.replace(0);
        assert_eq!(bytes, value.heap());
        let epoch = self.epoch;
        let trace = self.trace;
        let role = value.role();
        role_add(role);
        active(|a| {
            let mut a = a.borrow_mut();
            a.fixed += std::mem::size_of::<Owned<T>>();
            a.work.named_fixed_bytes_peak = a.work.named_fixed_bytes_peak.max(a.fixed as u64);
        });
        Owned {
            value: Some(value),
            bytes,
            trace,
            epoch,
            role,
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
pub(crate) fn descriptors(delta: isize) {
    active(|a| {
        let mut a = a.borrow_mut();
        a.descriptors = a
            .descriptors
            .checked_add_signed(delta)
            .expect("descriptor accounting");
        a.work.descriptor_handles_peak = a.work.descriptor_handles_peak.max(a.descriptors as u64);
        a.work.accounting_updates += 2;
    });
}
pub(crate) fn descriptor_baseline(n: usize) {
    active(|a| {
        let mut a = a.borrow_mut();
        a.descriptors = n;
        a.work.descriptor_handles_peak = n as u64;
        a.work.grant_vectors_peak = 1;
    });
}

pub(crate) fn epoch() -> u64 {
    active(|a| a.borrow().epoch)
}

pub(crate) fn history_begin(call: super::history::LedgerHistoryCall, payload: usize) {
    CONTINUITY_MODE.set(false);
    HISTORY_MODE.set(true);
    reset(payload);
    active(|a| a.borrow_mut().call = Some(call));
}
pub(crate) fn history_last() -> super::history::LedgerHistoryWork {
    HISTORY_LAST.get()
}
pub(crate) fn history_seal() -> super::history::LedgerHistoryWork {
    active(|a| {
        let a = a.borrow();
        let w = &a.work;
        let snapshot = super::history::LedgerHistoryWork {
            call: a.call,
            grant_admission: w.grant_admission,
            input_admission: w.input_admission,
            supplied_input_bytes: w.supplied_input_bytes,
            supplied_input_capacity: w.supplied_input_capacity,
            permissions: w.permissions,
            principals: w.principals,
            permission_denied: w.permission_denied,
            permission_unavailable: w.permission_unavailable,
            shared_passes: w.shared_passes,
            member_passes: w.member_passes,
            reads: w.reads,
            buffered_bytes: w.buffered_bytes,
            trace_bytes: w.trace_bytes,
            accepted_hash_bytes: w.accepted_hash_bytes,
            candidate_hash_bytes: w.candidate_hash_bytes,
            ingress: w.ingress,
            controls: w.controls,
            records: w.records,
            constructions: w.constructions,
            emissions: w.emissions,
            control_emissions: w.control_emissions,
            record_emissions: w.record_emissions,
            input_emissions: w.input_emissions,
            candidate_emissions: w.candidate_emissions,
            reply_emissions: w.reply_emissions,
            canonical: w.canonical,
            semantic: w.semantic,
            typed_input: w.typed_input,
            relationships: w.relationships,
            identifiers: w.identifiers,
            key_uniqueness: w.key_uniqueness,
            key_lookup: w.key_lookup,
            key_feasibility: w.key_feasibility,
            ordering: w.ordering,
            fields: w.fields,
            evaluator_calculations: w.evaluator_calculations,
            check_attempts: w.check_attempts,
            check_acceptances: w.check_acceptances,
            projection: w.projection,
            applicability: w.applicability,
            copied_record_bytes: w.copied_record_bytes,
            cleanup: w.cleanup,
            retention: w.retention,
            outputs: w.outputs,
            errors: w.errors,
            records_peak: w.records_peak,
            metadata_vectors_peak: w.metadata_vectors_peak,
            accepted_vectors_peak: w.accepted_vectors_peak,
            metadata_entries_peak: w.metadata_entries_peak,
            accepted_entries_peak: w.accepted_entries_peak,
            grant_vectors_peak: w.grant_vectors_peak,
            span_entries_peak: w.span_entries_peak,
            key_entries_peak: w.key_entries_peak,
            assessment_entries_peak: w.assessment_entries_peak,
            descriptor_handles_peak: w.descriptor_handles_peak,
            stack_bindings_peak: w.stack_bindings_peak,
            inventory_visits: w.inventory_visits,
            inventory_buffer_peak: w.inventory_buffer_peak,
            named_payload_peak: w.named_payload_peak,
            named_fixed_bytes_peak: w.named_fixed_bytes_peak,
            hash_state_bytes_peak: w.hash_state_bytes_peak,
            trace_buffers_peak: w.trace_buffers_peak,
            trace_capacity_peak: w.trace_capacity_peak,
            accounting_updates: w.accounting_updates,
        };
        HISTORY_LAST.set(snapshot);
        snapshot
    })
}

pub(crate) fn history_mode() -> bool {
    HISTORY_MODE.get() || CONTINUITY_MODE.get()
}

pub(crate) fn finish_history_output(ok: bool) {
    let pending = active(|a| {
        let a = a.borrow();
        a.work.outputs.attempts > a.work.outputs.completions
    });
    if pending {
        complete(Boundary::Outputs, ok);
    }
}

impl<T: Heap> Heap for Box<T> {
    fn heap(&self) -> usize {
        std::mem::size_of::<T>() + (**self).heap()
    }
    fn logical(&self) -> usize {
        (**self).logical()
    }
}

pub(crate) fn operands(b: Boundary, bytes: usize, words: usize) {
    active(|a| {
        let mut a = a.borrow_mut();
        let boundary = boundary(&mut a.work, b);
        boundary.operand_bytes += bytes as u64;
        boundary.schema_words += words as u64;
        a.work.accounting_updates += 1;
    });
}
impl<T: Heap + ?Sized> Heap for &T {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        (**self).logical()
    }
}
impl<T: Heap> Heap for [T] {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        self.iter().map(Heap::logical).sum()
    }
}
impl Heap for str {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        self.len()
    }
}

pub(crate) fn continuity_seal() -> super::continuity::LedgerContinuityWork {
    active(|a| {
        let a = a.borrow();
        let w = &a.work;
        let snapshot = super::continuity::LedgerContinuityWork {
            call: a.continuity_call,
            grant_admission: w.grant_admission,
            input_admission: w.input_admission,
            supplied_input_bytes: w.supplied_input_bytes,
            supplied_input_capacity: w.supplied_input_capacity,
            permissions: w.permissions,
            principals: w.principals,
            permission_denied: w.permission_denied,
            permission_unavailable: w.permission_unavailable,
            shared_passes: w.shared_passes,
            member_passes: w.member_passes,
            reads: w.reads,
            buffered_bytes: w.buffered_bytes,
            trace_bytes: w.trace_bytes,
            accepted_hash_bytes: w.accepted_hash_bytes,
            candidate_hash_bytes: w.candidate_hash_bytes,
            ingress: w.ingress,
            controls: w.controls,
            records: w.records,
            constructions: w.constructions,
            emissions: w.emissions,
            control_emissions: w.control_emissions,
            record_emissions: w.record_emissions,
            input_emissions: w.input_emissions,
            candidate_emissions: w.candidate_emissions,
            reply_emissions: w.reply_emissions,
            canonical: w.canonical,
            semantic: w.semantic,
            typed_input: w.typed_input,
            relationships: w.relationships,
            identifiers: w.identifiers,
            key_uniqueness: w.key_uniqueness,
            key_lookup: w.key_lookup,
            key_feasibility: w.key_feasibility,
            ordering: w.ordering,
            fields: w.fields,
            evaluator_calculations: w.evaluator_calculations,
            check_attempts: w.check_attempts,
            check_acceptances: w.check_acceptances,
            projection: w.projection,
            applicability: w.applicability,
            copied_record_bytes: w.copied_record_bytes,
            cleanup: w.cleanup,
            retention: w.retention,
            outputs: w.outputs,
            errors: w.errors,
            records_peak: w.records_peak,
            metadata_vectors_peak: w.metadata_vectors_peak,
            accepted_vectors_peak: w.accepted_vectors_peak,
            metadata_entries_peak: w.metadata_entries_peak,
            accepted_entries_peak: w.accepted_entries_peak,
            grant_vectors_peak: w.grant_vectors_peak,
            span_entries_peak: w.span_entries_peak,
            key_entries_peak: w.key_entries_peak,
            assessment_entries_peak: w.assessment_entries_peak,
            descriptor_handles_peak: w.descriptor_handles_peak,
            stack_bindings_peak: w.stack_bindings_peak,
            inventory_visits: w.inventory_visits,
            inventory_buffer_peak: w.inventory_buffer_peak,
            named_payload_peak: w.named_payload_peak,
            named_fixed_bytes_peak: w.named_fixed_bytes_peak,
            hash_state_bytes_peak: w.hash_state_bytes_peak,
            trace_buffers_peak: w.trace_buffers_peak,
            trace_capacity_peak: w.trace_capacity_peak,
            accounting_updates: w.accounting_updates,
            identity_acquisitions: w.identity_acquisitions,
            native_fstype: w.native_fstype,
            native_fsinfo: w.native_fsinfo,
            native_handle: w.native_handle,
            identity_format: w.identity_format,
            identity_comparisons: w.identity_comparisons,
            native_buffer_bytes: w.native_buffer_bytes,
            identity_raw_operand_bytes: w.identity_raw_operand_bytes,
            identity_text_operand_bytes: w.identity_text_operand_bytes,
            identity_scratch_bytes_peak: w.identity_scratch_bytes_peak,
            identity_io_failures: w.identity_io_failures,
            identity_refusals: w.identity_refusals,
        };
        CONTINUITY_LAST.set(snapshot);
        snapshot
    })
}

pub(crate) fn continuity_begin(call: super::continuity::LedgerContinuityCall, payload: usize) {
    CONTINUITY_MODE.set(true);
    HISTORY_MODE.set(false);
    reset(payload);
    active(|a| a.borrow_mut().continuity_call = Some(call));
}
pub(crate) fn continuity_mode() -> bool {
    CONTINUITY_MODE.get()
}
pub(crate) fn version() -> u64 {
    if continuity_mode() {
        6
    } else {
        5
    }
}
pub(crate) fn continuity_last() -> super::continuity::LedgerContinuityWork {
    CONTINUITY_LAST.get()
}
