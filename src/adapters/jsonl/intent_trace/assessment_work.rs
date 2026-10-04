//! Concrete profile-3 observations. No comparison wrapper, rescans or callbacks.
use super::IntentWork;
use std::cell::RefCell;
/// Logical boundary observations, not CPU-scanned bytes or instruction counts.
#[derive(Clone, Copy, Debug, Default)]
pub struct AssessmentComparison {
    pub attempts: u64,
    pub completions: u64,
    pub matches: u64,
    pub no_matches: u64,
    /// Conservative one-sided operand ranges, not bytes actually touched.
    pub operand_bytes: u64,
    /// Eight-byte accounting units, not layout or machine instructions.
    pub schema_words: u64,
    pub accounting_updates: u64,
}
#[derive(Clone, Copy, Debug, Default)]
pub struct AssessmentComparisons {
    pub record_canonical: AssessmentComparison,
    pub control_canonical: AssessmentComparison,
    pub record_semantic: AssessmentComparison,
    pub original_input: AssessmentComparison,
    pub key_uniqueness: AssessmentComparison,
    pub key_lookup: AssessmentComparison,
    pub key_feasibility: AssessmentComparison,
    pub control_typed: AssessmentComparison,
    pub suffix_prefix: AssessmentComparison,
    pub suffix_complete: AssessmentComparison,
    pub candidate: AssessmentComparison,
    pub member_selector: AssessmentComparison,
    pub field_groups: AssessmentComparison,
    pub initial_raw: AssessmentComparison,
    pub supplied_path: AssessmentComparison,
}
#[derive(Clone, Copy, Debug, Default)]
pub struct AssessmentWork {
    pub codecs: IntentWork,
    pub comparisons: AssessmentComparisons,
    pub semantic_attempts: u64,
    pub semantic_completions: u64,
    pub evaluator_constructions: u64,
    pub retained_assessment_validations: u64,
    pub cleanup_attempts: u64,
    pub cleanups: u64,
    pub retention_attempts: u64,
    /// Includes overlapping preflight and failed-read buffer capacities.
    pub trace_buffers_peak: u64,
    pub trace_buffer_capacity_peak: u64,
    pub max_pass_count: u64,
    pub key_vectors_peak: u64,
    pub key_vector_metadata_peak: u64,
    pub key_payload_capacity_peak: u64,
}
#[derive(Clone, Copy)]
pub(crate) enum Boundary {
    RecordCanonical,
    ControlCanonical,
    RecordSemantic,
    OriginalInput,
    KeyUniqueness,
    KeyLookup,
    KeyFeasibility,
    ControlTyped,
    SuffixPrefix,
    SuffixComplete,
    Candidate,
    MemberSelector,
    FieldGroups,
    InitialRaw,
    SuppliedPath,
}
#[derive(Default)]
struct Active {
    work: AssessmentWork,
    record_codec: bool,
    retained_trace: usize,
    key_vectors: u64,
}
thread_local! { static ACTIVE:RefCell<Option<Active>>=const { RefCell::new(None) }; }
impl Active {
    fn comparison(&mut self, b: Boundary) -> &mut AssessmentComparison {
        let c = &mut self.work.comparisons;
        match b {
            Boundary::RecordCanonical => &mut c.record_canonical,
            Boundary::ControlCanonical => &mut c.control_canonical,
            Boundary::RecordSemantic => &mut c.record_semantic,
            Boundary::OriginalInput => &mut c.original_input,
            Boundary::KeyUniqueness => &mut c.key_uniqueness,
            Boundary::KeyLookup => &mut c.key_lookup,
            Boundary::KeyFeasibility => &mut c.key_feasibility,
            Boundary::ControlTyped => &mut c.control_typed,
            Boundary::SuffixPrefix => &mut c.suffix_prefix,
            Boundary::SuffixComplete => &mut c.suffix_complete,
            Boundary::Candidate => &mut c.candidate,
            Boundary::MemberSelector => &mut c.member_selector,
            Boundary::FieldGroups => &mut c.field_groups,
            Boundary::InitialRaw => &mut c.initial_raw,
            Boundary::SuppliedPath => &mut c.supplied_path,
        }
    }
}
impl AssessmentWork {
    fn unfinished_accounting(&mut self) {
        // Completed boundaries perform six counter updates. An interrupted
        // attempt performs three, plus this bounded snapshot update. No logical
        // comparison is repeated, and observation guards are not instrumented.
        let c = &mut self.comparisons;
        for c in [
            &mut c.record_canonical,
            &mut c.control_canonical,
            &mut c.record_semantic,
            &mut c.original_input,
            &mut c.key_uniqueness,
            &mut c.key_lookup,
            &mut c.key_feasibility,
            &mut c.control_typed,
            &mut c.suffix_prefix,
            &mut c.suffix_complete,
            &mut c.candidate,
            &mut c.member_selector,
            &mut c.field_groups,
            &mut c.initial_raw,
            &mut c.supplied_path,
        ] {
            if c.attempts > c.completions {
                c.accounting_updates += 4 * (c.attempts - c.completions);
            }
        }
    }
}
pub(crate) fn begin() {
    ACTIVE.with(|a| *a.borrow_mut() = Some(Active::default()));
}
pub(crate) fn finish_connection() -> AssessmentWork {
    ACTIVE.with(|a| {
        let mut work = a
            .borrow_mut()
            .take()
            .map_or_else(AssessmentWork::default, |a| a.work);
        work.unfinished_accounting();
        work
    })
}
pub(crate) fn connection_pass(w: &IntentWork) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            let c = &mut a.work.codecs;
            c.passes += w.passes;
            c.validated_prefixes += w.validated_prefixes;
            c.record_decode_attempts += w.record_decode_attempts;
            c.record_decodes += w.record_decodes;
            c.record_reemission_attempts += w.record_reemission_attempts;
            c.record_reemissions += w.record_reemissions;
            c.constructed_record_attempts += w.constructed_record_attempts;
            c.constructed_record_emissions += w.constructed_record_emissions;
            c.accepted_hash_bytes += w.accepted_hash_bytes;
            c.successor_hash_bytes += w.successor_hash_bytes;
        }
    });
}
pub(crate) fn read_bytes(trace: bool, bytes: usize) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            if trace {
                a.work.codecs.trace_read_bytes += bytes as u64;
            } else {
                a.work.codecs.control_read_bytes += bytes as u64;
            }
        }
    });
}
pub(crate) fn retained_decode_attempt() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            if !a.record_codec {
                a.work.codecs.control_decode_attempts += 1;
            }
        }
    });
}
pub(crate) fn retained_decode_complete() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            if !a.record_codec {
                a.work.codecs.control_decodes += 1;
            }
        }
    });
}
pub(crate) fn retained_emit_attempt() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            if !a.record_codec {
                a.work.codecs.control_reemission_attempts += 1;
            }
        }
    });
}
pub(crate) fn retained_emit_complete() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            if !a.record_codec {
                a.work.codecs.control_reemissions += 1;
            }
        }
    });
}
pub(crate) fn control_construct_attempt() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.codecs.constructed_control_attempts += 1;
        }
    });
}
pub(crate) fn control_construct_complete() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.codecs.constructed_control_emissions += 1;
        }
    });
}
pub(crate) fn finish(codecs: IntentWork) -> AssessmentWork {
    ACTIVE.with(|a| {
        let mut w = a
            .borrow_mut()
            .take()
            .map_or_else(AssessmentWork::default, |a| a.work);
        w.codecs = codecs;
        w.unfinished_accounting();
        w
    })
}
pub(crate) fn attempt(b: Boundary, payload: u64, words: u64) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            let c = a.comparison(b);
            c.attempts += 1;
            c.operand_bytes += payload;
            c.schema_words += words;
        }
    });
}
pub(crate) fn complete(b: Boundary, matched: bool) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            let c = a.comparison(b);
            c.completions += 1;
            if matched {
                c.matches += 1;
            } else {
                c.no_matches += 1;
            }
            c.accounting_updates += 6;
        }
    });
}
pub(crate) fn field_attempt(payload: u64) {
    attempt(Boundary::FieldGroups, payload, 64);
}
pub(crate) fn field_complete(matched: bool) {
    complete(Boundary::FieldGroups, matched);
}
pub(crate) fn member_attempt(name: &str) {
    attempt(Boundary::MemberSelector, 17 * name.len() as u64 + 512, 64);
}
pub(crate) fn member_complete(matched: bool) {
    complete(Boundary::MemberSelector, matched);
}
pub(crate) fn record_codec(active: bool) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.record_codec = active;
        }
    });
}
pub(crate) fn canonical_attempt(payload: u64) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            let b = if a.record_codec {
                Boundary::RecordCanonical
            } else {
                Boundary::ControlCanonical
            };
            let c = a.comparison(b);
            c.attempts += 1;
            c.operand_bytes += payload;
            c.schema_words += 1;
        }
    });
}
pub(crate) fn canonical_complete(matched: bool) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            let b = if a.record_codec {
                Boundary::RecordCanonical
            } else {
                Boundary::ControlCanonical
            };
            let c = a.comparison(b);
            c.completions += 1;
            if matched {
                c.matches += 1;
            } else {
                c.no_matches += 1;
            }
            c.accounting_updates += 6;
        }
    });
}
pub(crate) fn semantic_attempt() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.semantic_attempts += 1;
        }
    });
}
pub(crate) fn semantic_complete() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.semantic_completions += 1;
        }
    });
}
pub(crate) fn evaluate() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.evaluator_constructions += 1;
        }
    });
}
pub(crate) fn validate_assessment() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.retained_assessment_validations += 1;
        }
    });
}
pub(crate) fn cleanup_attempt() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.cleanup_attempts += 1;
        }
    });
}
pub(crate) fn cleanup_complete() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.cleanups += 1;
        }
    });
}
pub(crate) fn retain() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.retention_attempts += 1;
        }
    });
}
pub(crate) fn pass_count(n: u64) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.max_pass_count = a.work.max_pass_count.max(n);
        }
    });
}
pub(crate) fn retained_trace(capacity: usize) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.retained_trace = capacity;
        }
    });
}
pub(crate) fn trace_capacity(capacity: usize) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.trace_buffers_peak =
                a.work
                    .trace_buffers_peak
                    .max(if a.retained_trace > 0 { 2 } else { 1 });
            a.work.trace_buffer_capacity_peak = a
                .work
                .trace_buffer_capacity_peak
                .max((capacity + a.retained_trace) as u64);
        }
    });
}

pub(crate) fn key_owner_start() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.key_vectors += 1;
            a.work.key_vectors_peak = a.work.key_vectors_peak.max(a.key_vectors);
        }
    });
}
pub(crate) fn key_owner_end() {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.key_vectors -= 1;
        }
    });
}
pub(crate) fn key_capacity(metadata: usize, payload: usize) {
    ACTIVE.with(|a| {
        if let Some(a) = a.borrow_mut().as_mut() {
            a.work.key_vector_metadata_peak = a.work.key_vector_metadata_peak.max(metadata as u64);
            a.work.key_payload_capacity_peak = a.work.key_payload_capacity_peak.max(payload as u64);
        }
    });
}
