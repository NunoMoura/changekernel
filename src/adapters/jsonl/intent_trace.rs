//! Profile-selected sequential custody using the opening fixture's concrete syscalls.
pub(crate) mod assessment_codec;
pub mod assessment_work;
mod codec;
use super::opening::{
    codec::{decode, emit, emit_query, retained_counted, RetainedWork, LIMIT},
    storage::{Failure, Profile, Storage},
    OpeningIoHook, OpeningMode, OpeningSlot,
};
use crate::kernel::changes::{
    assessment::{self, Assessed, Assessment, Evidence, CHECK, EVALUATOR, POLICY},
    intent_trace::{logical, Request, Revised, Revision},
    opening::{Opened, OpeningError, Origin},
};
use assessment_work::{self as observation, Boundary};
use codec::{Pending, Prefix};
use serde_core::{ser::SerializeStruct, Serialize, Serializer};
use sha2::{Digest, Sha256};
const ACCEPTED: u64 = 16_777_216;
const TOTAL: usize = 17_825_792;

/// Trusted-fixture observation, not a JSON option or persistent index.
#[derive(Clone, Copy, Debug, Default)]
pub struct IntentWork {
    /// Attempts invoke the bounded codec; completions mean it returned bytes/a
    /// typed value successfully, not authority, canonical equality or delivery.
    pub request_decode_attempts: u64,
    pub request_decodes: u64,
    pub reply_emission_attempts: u64,
    pub reply_emissions: u64,
    pub error_replies: u64,
    pub discarded_replies: u64,
    /// Entered validation passes and fully validated prefix/temporary proofs.
    /// Completion precedes cleanup/barriers and does not mean durable delivery.
    pub passes: u64,
    pub validated_prefixes: u64,
    /// Bytes appended to bounded file-read buffers, including failed reads.
    /// Excludes metadata, syscalls, filesystem-cache/disk traffic and writes.
    pub trace_read_bytes: u64,
    pub control_read_bytes: u64,
    pub accepted_hash_bytes: u64,
    pub successor_hash_bytes: u64,
    pub control_decode_attempts: u64,
    pub control_decodes: u64,
    pub control_reemission_attempts: u64,
    pub control_reemissions: u64,
    pub constructed_control_attempts: u64,
    pub constructed_control_emissions: u64,
    pub constructed_record_attempts: u64,
    pub constructed_record_emissions: u64,
    pub record_decode_attempts: u64,
    pub record_decodes: u64,
    pub record_reemission_attempts: u64,
    pub record_reemissions: u64,
    /// Maximum successful-read trace buffers (including retained preflight).
    /// A failed read's private buffer is not returned to this pass.
    pub trace_buffers_peak: u64,
    pub trace_buffer_bytes_peak: u64,
}
pub(crate) struct Custody {
    storage: Storage,
    work: IntentWork,
}
#[derive(Clone, Debug, PartialEq, Eq)]
enum Record {
    Origin(Origin),
    Revision(Revision),
    Assessment(Assessment),
}
impl Record {
    fn input_payload(&self) -> u64 {
        match self {
            Self::Revision(r) => r.input.payload(),
            Self::Assessment(r) => r.input.payload(),
            Self::Origin(r) => {
                (r.input.op.len()
                    + r.input.workspace_id.len()
                    + r.input.change.len()
                    + r.input.key.as_ref().map_or(0, String::len)
                    + r.input.what.as_ref().map_or(0, String::len)
                    + r.input
                        .why
                        .as_ref()
                        .and_then(|s| s.as_ref())
                        .map_or(0, String::len)) as u64
            }
        }
    }
    fn matches_input(&self, input: &Request) -> bool {
        match self {
            Self::Revision(r) => &r.input == input,
            Self::Assessment(r) => &r.input == input,
            Self::Origin(r) => {
                input.expected_intent.is_none()
                    && input.at.is_none()
                    && input.check.is_none()
                    && (
                        r.input.v,
                        &r.input.op,
                        &r.input.workspace_id,
                        &r.input.change,
                        &r.input.key,
                        &r.input.what,
                        &r.input.why,
                    ) == (
                        input.v,
                        &input.op,
                        &input.workspace_id,
                        &input.change,
                        &input.key,
                        &input.what,
                        &input.why,
                    )
            }
        }
    }
    fn payload(&self) -> u64 {
        self.input_payload()
            + match self {
                Self::Origin(r) => {
                    (r.custody.len()
                        + r.workspace_id.len()
                        + r.binding.len()
                        + r.change.len()
                        + r.prev.as_ref().map_or(0, String::len)
                        + r.kind.len()
                        + r.result.kind.len()
                        + r.result.workspace_id.len()
                        + r.result.change.len()
                        + r.result.key.len()
                        + r.result.actor.len()
                        + r.result.result.len()) as u64
                }
                Self::Revision(r) => {
                    (r.custody.len()
                        + r.workspace_id.len()
                        + r.binding.len()
                        + r.change.len()
                        + r.prev.len()
                        + r.kind.len()
                        + r.result.kind.len()
                        + r.result.workspace_id.len()
                        + r.result.change.len()
                        + r.result.key.len()
                        + r.result.actor.len()
                        + r.result.result.len()
                        + r.result.intent.len()
                        + r.result.previous_intent.len()) as u64
                }
                Self::Assessment(r) => {
                    (r.custody.len()
                        + r.workspace_id.len()
                        + r.binding.len()
                        + r.change.len()
                        + r.prev.len()
                        + r.kind.len()
                        + r.result.kind.len()
                        + r.result.workspace_id.len()
                        + r.result.change.len()
                        + r.result.key.len()
                        + r.result.actor.len()
                        + r.result.result.len()
                        + r.result.intent.len()
                        + r.result.policy.len()
                        + r.result.check.len()
                        + r.result.evaluator.len()
                        + r.result.feedback.len()
                        + r.result.evidence.intent.len()
                        + r.result.evidence.field.len()) as u64
                }
            }
    }
    fn input(&self) -> Request {
        match self {
            Self::Origin(r) => Request::from_opening(r.input.clone()),
            Self::Revision(r) => r.input.clone(),
            Self::Assessment(r) => r.input.clone(),
        }
    }
    fn key(&self) -> &str {
        match self {
            Self::Origin(r) => &r.result.key,
            Self::Revision(r) => &r.result.key,
            Self::Assessment(r) => &r.result.key,
        }
    }
    fn actor(&self) -> &str {
        match self {
            Self::Origin(r) => &r.result.actor,
            Self::Revision(r) => &r.result.actor,
            Self::Assessment(r) => &r.result.actor,
        }
    }
    fn result(&self) -> Result<Vec<u8>, ()> {
        match self {
            Self::Origin(r) => emit(&r.result),
            Self::Revision(r) => emit(&r.result),
            Self::Assessment(r) => emit(&r.result),
        }
    }
}
impl Serialize for Record {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Origin(r) => r.serialize(s),
            Self::Revision(r) => r.serialize(s),
            Self::Assessment(r) => r.serialize(s),
        }
    }
}
// Concrete owning key vector: no index, extra scan or observer-owned key copy.
#[derive(Default)]
struct Keys {
    values: Vec<String>,
    payload_capacity: usize,
}
impl Keys {
    fn push(&mut self, key: String) {
        let unallocated = self.values.capacity() == 0;
        self.payload_capacity += key.capacity();
        self.values.push(key);
        if unallocated {
            observation::key_owner_start();
        }
        observation::key_capacity(
            self.values.capacity() * std::mem::size_of::<String>(),
            self.payload_capacity,
        );
    }
}
impl std::ops::Deref for Keys {
    type Target = [String];
    fn deref(&self) -> &[String] {
        &self.values
    }
}
impl Drop for Keys {
    fn drop(&mut self) {
        if self.values.capacity() > 0 {
            observation::key_owner_end();
        }
    }
}
struct Validated {
    prefix: Prefix,
    trace: Vec<u8>,
    selected: Option<Record>,
    matched: Option<Record>,
    next: Option<Vec<u8>>,
    hash: Sha256,
    keys: Keys,
    current_intent: u64,
    what_bytes: u64,
}
pub(crate) fn initial_prefix() -> Prefix {
    Prefix {
        format: "ck-intent-prefix@2".into(),
        custody: "custody-1".into(),
        change: "change-1".into(),
        generation: 0,
        end: 0,
        sha256: None,
        pending: None,
    }
}
pub(crate) fn initial_assessment_prefix() -> Prefix {
    Prefix {
        format: "ck-assessment-prefix@3".into(),
        ..initial_prefix()
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ReadKind {
    None,
    Intent,
    Assessment,
}
fn construct(
    p: &Pending,
    seq: u64,
    profile: Profile,
    current: u64,
    what_bytes: u64,
) -> Result<Record, Failure> {
    observation::semantic_attempt();
    let result = construct_inner(p, seq, profile, current, what_bytes);
    if result.is_ok() {
        observation::semantic_complete();
    }
    result
}
fn construct_inner(
    p: &Pending,
    seq: u64,
    profile: Profile,
    current: u64,
    what_bytes: u64,
) -> Result<Record, Failure> {
    observation::field_attempt(512);
    let invalid = p.actor != "owner-1"
        || !(p.input.valid() || (profile == Profile::Assessment && assessment::valid(&p.input)))
        || p.input.workspace_id != "workspace-1"
        || p.input.change != "change-1"
        || !(1..=128).contains(&seq);
    observation::field_complete(!invalid);
    if invalid {
        return Err(Failure::damage());
    }
    let r = &p.input;
    observation::field_attempt(0);
    let origin = seq == 1;
    observation::field_complete(origin);
    if origin {
        observation::field_attempt(24);
        let opening = r.op == "open_change" && r.key.as_deref() == Some("open-1");
        observation::field_complete(opening);
        if !opening {
            return Err(Failure::damage());
        }
        Ok(Record::Origin(Origin {
            v: 1,
            custody: "custody-1".into(),
            workspace_id: r.workspace_id.clone(),
            binding: "fixture@1".into(),
            change: r.change.clone(),
            seq: 1,
            prev: None,
            kind: "opened".into(),
            input: r.opening(),
            result: Opened {
                v: 1,
                kind: "opened".into(),
                workspace_id: r.workspace_id.clone(),
                change: r.change.clone(),
                key: "open-1".into(),
                actor: p.actor.clone(),
                result: logical(1),
                seq: 1,
            },
        }))
    } else {
        observation::field_attempt(71);
        let current_subject = r.expected_intent.as_deref() == Some(logical(current).as_str());
        observation::field_complete(current_subject);
        if !current_subject {
            return Err(Failure::damage());
        }
        observation::field_attempt(64);
        let assess = profile == Profile::Assessment
            && r.op == "assess_intent"
            && r.v == 3
            && r.check.as_deref() == Some(CHECK);
        observation::field_complete(assess);
        if assess {
            observation::evaluate();
            observation::field_attempt(0);
            let passed = what_bytes <= 80;
            observation::field_complete(passed);
            return Ok(Record::Assessment(Assessment {
                v: 3,
                custody: "custody-1".into(),
                workspace_id: r.workspace_id.clone(),
                binding: "fixture@1".into(),
                change: r.change.clone(),
                seq,
                prev: logical(seq - 1),
                kind: "intent_assessed".into(),
                input: r.clone(),
                result: Assessed {
                    v: 3,
                    kind: "intent_assessed".into(),
                    workspace_id: r.workspace_id.clone(),
                    change: r.change.clone(),
                    key: r.key.clone().ok_or_else(Failure::damage)?,
                    actor: p.actor.clone(),
                    result: logical(seq),
                    seq,
                    intent: logical(current),
                    policy: POLICY.into(),
                    check: CHECK.into(),
                    evaluator: EVALUATOR.into(),
                    passed,
                    feedback: if passed {
                        "fits"
                    } else {
                        "shorten_or_use_other_channel"
                    }
                    .into(),
                    evidence: Evidence {
                        intent: logical(current),
                        field: "what".into(),
                        utf8_bytes: what_bytes,
                        limit: 80,
                    },
                },
            }));
        }
        observation::field_attempt(13);
        let revision =
            r.op == "revise_intent" && r.v == if profile == Profile::Assessment { 3 } else { 2 };
        observation::field_complete(revision);
        if !revision {
            return Err(Failure::damage());
        }
        Ok(Record::Revision(Revision {
            v: if profile == Profile::Assessment { 3 } else { 2 },
            custody: "custody-1".into(),
            workspace_id: r.workspace_id.clone(),
            binding: "fixture@1".into(),
            change: r.change.clone(),
            seq,
            prev: logical(seq - 1),
            kind: "intent_revised".into(),
            input: r.clone(),
            result: Revised {
                v: if profile == Profile::Assessment { 3 } else { 2 },
                kind: "intent_revised".into(),
                workspace_id: r.workspace_id.clone(),
                change: r.change.clone(),
                key: r.key.clone().ok_or_else(Failure::damage)?,
                actor: p.actor.clone(),
                result: logical(seq),
                seq,
                intent: logical(seq),
                previous_intent: logical(current),
            },
        }))
    }
}
fn emit_record(record: &Record, work: &mut IntentWork) -> Result<Vec<u8>, ()> {
    work.constructed_record_attempts += 1;
    let bytes = emit(record)?;
    work.constructed_record_emissions += 1;
    Ok(bytes)
}
fn retained_record(
    line: &[u8],
    seq: u64,
    profile: Profile,
    work: &mut IntentWork,
) -> Result<Record, Failure> {
    let mut counted = RetainedWork::default();
    observation::record_codec(true);
    let value = if seq == 1 && profile == Profile::Assessment {
        retained_counted::<assessment_codec::AssessmentOrigin>(line, &mut counted)
            .map(|r| Record::Origin(r.origin()))
    } else if seq == 1 {
        retained_counted(line, &mut counted).map(Record::Origin)
    } else if profile == Profile::Assessment {
        retained_counted::<assessment_codec::Operation>(line, &mut counted).map(|r| {
            match r.result {
                assessment_codec::ResultUnion::Revised(result) => Record::Revision(Revision {
                    v: r.v,
                    custody: r.custody,
                    workspace_id: r.workspace_id,
                    binding: r.binding,
                    change: r.change,
                    seq: r.seq,
                    prev: r.prev,
                    kind: r.kind,
                    input: r.input,
                    result,
                }),
                assessment_codec::ResultUnion::Assessed(result) => Record::Assessment(Assessment {
                    v: r.v,
                    custody: r.custody,
                    workspace_id: r.workspace_id,
                    binding: r.binding,
                    change: r.change,
                    seq: r.seq,
                    prev: r.prev,
                    kind: r.kind,
                    input: r.input,
                    result,
                }),
            }
        })
    } else {
        retained_counted(line, &mut counted).map(Record::Revision)
    };
    observation::record_codec(false);
    work.record_decode_attempts += counted.decode_attempts;
    work.record_decodes += counted.decodes;
    work.record_reemission_attempts += counted.emission_attempts;
    work.record_reemissions += counted.emissions;
    value.map_err(|_| Failure::damage())
}
fn feasible(
    profile: Profile,
    subject: (u64, u64),
    prefix: &Prefix,
    p: &Pending,
    keys: &[String],
    trace: &[u8],
    work: &mut IntentWork,
) -> Result<Vec<u8>, Failure> {
    let (current, what_bytes) = subject;
    observation::field_attempt(0);
    let full = prefix.generation >= 128;
    observation::field_complete(!full);
    if full
        || keys.iter().any(|k| {
            observation::attempt(
                Boundary::KeyFeasibility,
                k.len().max(p.input.key.as_ref().map_or(0, String::len)) as u64,
                1,
            );
            let equal = Some(k.as_str()) == p.input.key.as_deref();
            observation::complete(Boundary::KeyFeasibility, equal);
            equal
        })
    {
        return Err(Failure::damage());
    }
    let record = construct(
        p,
        prefix
            .generation
            .checked_add(1)
            .ok_or_else(Failure::damage)?,
        profile,
        current,
        what_bytes,
    )?;
    let bytes = emit_record(&record, work).map_err(|_| Failure::damage())?;
    observation::field_attempt(0);
    let invalid_capacity = bytes.is_empty()
        || prefix
            .end
            .checked_add(bytes.len() as u64)
            .is_none_or(|n| n > ACCEPTED);
    observation::field_complete(!invalid_capacity);
    if invalid_capacity {
        return Err(Failure::damage());
    }
    let suffix = &trace[prefix.end as usize..];
    observation::attempt(
        Boundary::SuffixPrefix,
        if suffix.len() <= bytes.len() {
            suffix.len() as u64
        } else {
            0
        },
        1,
    );
    let matches = bytes.starts_with(suffix);
    observation::complete(Boundary::SuffixPrefix, matches);
    if !matches {
        return Err(Failure::damage());
    }
    Ok(bytes)
}
fn successor(v: &Validated, bytes: &[u8], work: &mut IntentWork) -> Result<Prefix, Failure> {
    let mut hash = v.hash.clone();
    hash.update(bytes);
    work.successor_hash_bytes += bytes.len() as u64;
    Ok(Prefix {
        generation: v
            .prefix
            .generation
            .checked_add(1)
            .ok_or_else(Failure::damage)?,
        end: v
            .prefix
            .end
            .checked_add(bytes.len() as u64)
            .filter(|n| {
                observation::field_attempt(0);
                let bounded = *n <= ACCEPTED;
                observation::field_complete(bounded);
                bounded
            })
            .ok_or_else(Failure::damage)?,
        sha256: Some(format!("{:x}", hash.finalize())),
        pending: None,
        ..v.prefix.clone()
    })
}
fn pass(
    s: &mut Storage,
    key: Option<&str>,
    at: Option<u64>,
    read: ReadKind,
    work: &mut IntentWork,
    retained_trace: usize,
) -> Result<Validated, Failure> {
    work.passes += 1;
    s.identity()?;
    s.inventory(false)?;
    s.check_incident()?;
    let prefix: Prefix = s.read_canonical("checkpoint.json")?;
    let profile = s.profile();
    observation::field_attempt(64);
    let invalid = prefix.format
        != if profile == Profile::Assessment {
            "ck-assessment-prefix@3"
        } else {
            "ck-intent-prefix@2"
        }
        || prefix.custody != "custody-1"
        || prefix.change != "change-1"
        || prefix.generation > 128
        || prefix.end > ACCEPTED;
    observation::field_complete(!invalid);
    if invalid {
        return Err(Failure::damage());
    }
    observation::pass_count(prefix.generation);
    observation::retained_trace(retained_trace);
    let trace = s.read("trace.jsonl", TOTAL)?;
    work.trace_buffers_peak = work
        .trace_buffers_peak
        .max(if retained_trace > 0 { 2 } else { 1 });
    work.trace_buffer_bytes_peak = work
        .trace_buffer_bytes_peak
        .max((trace.capacity() + retained_trace) as u64);
    observation::field_attempt(0);
    let invalid = prefix.end > trace.len() as u64
        || (prefix.generation == 0 && (prefix.end != 0 || prefix.sha256.is_some()))
        || (prefix.generation > 0 && (prefix.end == 0 || prefix.sha256.is_none()));
    observation::field_complete(!invalid);
    if invalid {
        return Err(Failure::damage());
    }
    let accepted = &trace[..prefix.end as usize];
    let mut hash = Sha256::new();
    hash.update(accepted);
    work.accepted_hash_bytes += accepted.len() as u64;
    observation::field_attempt(0);
    let has_digest = prefix.generation > 0;
    observation::field_complete(has_digest);
    if has_digest {
        observation::field_attempt(64);
        let equal =
            prefix.sha256.as_deref() == Some(format!("{:x}", hash.clone().finalize()).as_str());
        observation::field_complete(equal);
        if !equal {
            return Err(Failure::damage());
        }
    }
    let mut keys = Keys::default();
    let mut selected = None;
    let mut matched = None;
    let mut seq = 0;
    let mut current_intent = 0;
    let mut what_bytes = 0;
    for line in accepted.split_inclusive(|b| *b == b'\n') {
        seq += 1;
        observation::field_attempt(0);
        let admitted = seq <= prefix.generation && line.len() <= LIMIT;
        observation::field_complete(admitted);
        if !admitted {
            return Err(Failure::damage());
        }
        let record = retained_record(line, seq, profile, work)?;
        let expected = construct(
            &Pending {
                input: record.input(),
                actor: record.actor().into(),
            },
            seq,
            profile,
            current_intent,
            what_bytes,
        )?;
        observation::attempt(
            Boundary::RecordSemantic,
            record.payload().max(expected.payload()),
            64,
        );
        let equal = record == expected;
        observation::complete(Boundary::RecordSemantic, equal);
        if matches!(record, Record::Assessment(_)) {
            observation::validate_assessment();
        }
        if !equal {
            return Err(Failure::damage());
        }
        drop(expected);
        let duplicate = keys.iter().any(|k: &String| {
            observation::attempt(
                Boundary::KeyUniqueness,
                k.len().max(record.key().len()) as u64,
                1,
            );
            let equal = k == record.key();
            observation::complete(Boundary::KeyUniqueness, equal);
            equal
        });
        if duplicate {
            return Err(Failure::damage());
        }
        keys.push(record.key().to_owned());
        observation::attempt(
            Boundary::KeyLookup,
            key.map_or(0, |k| k.len().max(record.key().len()) as u64),
            1,
        );
        let key_match = key == Some(record.key());
        observation::complete(Boundary::KeyLookup, key_match);

        observation::field_attempt(0);
        let is_intent = !matches!(record, Record::Assessment(_));
        observation::field_complete(is_intent);
        if is_intent {
            current_intent = seq;
            what_bytes = match &record {
                Record::Origin(r) => r.input.what.as_ref().map_or(0, |s| s.len() as u64),
                Record::Revision(r) => r.input.what.as_ref().map_or(0, |s| s.len() as u64),
                _ => unreachable!(),
            };
            observation::field_attempt(0);
            let reset_assessment = read == ReadKind::Assessment && at.is_none();
            observation::field_complete(reset_assessment);
            if reset_assessment {
                selected = None;
            }
        }
        observation::field_attempt(0);
        let select = (read == ReadKind::Intent && is_intent
            || read == ReadKind::Assessment && !is_intent)
            && at.is_none_or(|n| n == seq);
        observation::field_complete(select);
        if select {
            selected = Some(record);
        } else if key_match {
            matched = Some(record);
        }
    }
    observation::field_attempt(0);
    let complete = seq == prefix.generation;
    observation::field_complete(complete);
    if !complete {
        return Err(Failure::damage());
    }
    observation::field_attempt(0);
    let next = if let Some(p) = &prefix.pending {
        observation::field_complete(true);
        Some(feasible(
            profile,
            (current_intent, what_bytes),
            &prefix,
            p,
            &keys,
            &trace,
            work,
        )?)
    } else {
        observation::field_complete(false);
        observation::field_attempt(0);
        let unexpected_tail = prefix.generation == 0 && !trace.is_empty();
        observation::field_complete(!unexpected_tail);
        if unexpected_tail {
            return Err(Failure::damage());
        }
        None
    };
    let v = Validated {
        prefix,
        trace,
        selected,
        matched,
        next,
        hash,
        keys,
        current_intent,
        what_bytes,
    };
    observation::field_attempt(0);
    let temporary = s.exists("checkpoint.tmp")?;
    observation::field_complete(temporary);
    if temporary {
        let temp: Prefix = s.read_canonical("checkpoint.tmp")?;
        observation::attempt(
            Boundary::ControlTyped,
            temp.payload().max(v.prefix.payload()),
            64,
        );
        let equal = temp == v.prefix;
        observation::complete(Boundary::ControlTyped, equal);
        let known = if equal {
            true
        } else {
            observation::field_attempt(0);
            let reservation = v.prefix.pending.is_none() && v.trace.len() as u64 == v.prefix.end;
            observation::field_complete(reservation);
            if reservation {
                let reserved = Prefix {
                    pending: temp.pending.clone(),
                    ..v.prefix.clone()
                };
                observation::attempt(
                    Boundary::ControlTyped,
                    temp.payload().max(reserved.payload()),
                    64,
                );
                let equal = temp == reserved;
                observation::complete(Boundary::ControlTyped, equal);
                if equal {
                    observation::field_attempt(0);
                    if let Some(p) = &temp.pending {
                        observation::field_complete(true);
                        feasible(
                            profile,
                            (v.current_intent, v.what_bytes),
                            &v.prefix,
                            p,
                            &v.keys,
                            &v.trace,
                            work,
                        )?;
                        true
                    } else {
                        observation::field_complete(false);
                        false
                    }
                } else {
                    false
                }
            } else {
                observation::field_attempt(0);
                if let Some(bytes) = &v.next {
                    observation::field_complete(true);
                    let suffix = &v.trace[v.prefix.end as usize..];
                    observation::attempt(
                        Boundary::SuffixComplete,
                        suffix.len().max(bytes.len()) as u64,
                        1,
                    );
                    let equal = suffix == bytes;
                    observation::complete(Boundary::SuffixComplete, equal);
                    if equal {
                        let next = successor(&v, bytes, work)?;
                        observation::attempt(
                            Boundary::ControlTyped,
                            temp.payload().max(next.payload()),
                            64,
                        );
                        let equal = temp == next;
                        observation::complete(Boundary::ControlTyped, equal);
                        equal
                    } else {
                        false
                    }
                } else {
                    observation::field_complete(false);
                    false
                }
            }
        };
        if !known {
            return Err(Failure::damage());
        }
        work.validated_prefixes += 1;
        observation::cleanup_attempt();
        s.remove("checkpoint.tmp")?;
        s.sync_directory()?;
        observation::cleanup_complete();
        // Fresh post-cleanup validation; previous buffers are released before reread.
        drop(v);
        return pass(s, key, at, read, work, retained_trace);
    }
    work.validated_prefixes += 1;
    // Close interrupted cleanup's absent-temporary directory barrier too.
    s.sync_directory()?;
    Ok(v)
}
pub(crate) fn validate_connect(s: &mut Storage) -> Result<(), Failure> {
    let mut work = IntentWork::default();
    let result = pass(s, None, None, ReadKind::None, &mut work, 0).map(|_| ());
    observation::connection_pass(&work);
    result
}
impl Custody {
    pub fn connect(
        slot: OpeningSlot,
        mode: OpeningMode,
        hook: Option<OpeningIoHook>,
    ) -> Result<Self, OpeningError> {
        Ok(Self {
            storage: Storage::connect_profile(slot, mode, hook, Profile::Intent)
                .map_err(|_| OpeningError::Unavailable)?,
            work: IntentWork::default(),
        })
    }
    pub fn connect_assessment(
        slot: OpeningSlot,
        mode: OpeningMode,
        hook: Option<OpeningIoHook>,
    ) -> Result<Self, OpeningError> {
        Ok(Self {
            storage: Storage::connect_profile(slot, mode, hook, Profile::Assessment)
                .map_err(|_| OpeningError::Unavailable)?,
            work: IntentWork::default(),
        })
    }
    pub fn assessment_request(&mut self, bytes: &[u8]) -> Result<Request, OpeningError> {
        self.work.request_decode_attempts += 1;
        let value: Request = decode(bytes).map_err(|_| OpeningError::InvalidInput)?;
        self.work.request_decodes += 1;
        Ok(value)
    }
    pub fn work(&self) -> IntentWork {
        self.work
    }
    pub fn reset_work(&mut self) {
        self.work = IntentWork::default();
        self.storage.trace_read.set(0);
        self.storage.control_read.set(0);
        self.storage.control_codec.set(RetainedWork::default());
        self.storage.constructed_control_attempts.set(0);
        self.storage.constructed_control_emissions.set(0);
    }
    fn run<T>(
        &mut self,
        phase: &'static str,
        f: impl FnOnce(&mut Storage, &mut IntentWork) -> Result<T, Failure>,
    ) -> Result<T, OpeningError> {
        observation::field_attempt(0);
        let available = !self.storage.latched;
        observation::field_complete(available);
        if !available {
            return Err(OpeningError::Unavailable);
        }
        self.storage.phase = phase;
        let answer = f(&mut self.storage, &mut self.work);
        let answer = answer.map_err(|e| {
            self.storage.retain_failure(&e);
            OpeningError::Unavailable
        });
        // Retention may reread/canonicalize incident.json and construct a blocked
        // replacement even when the original operation failed. Snapshot last.
        self.work.trace_read_bytes = self.storage.trace_read.get();
        self.work.control_read_bytes = self.storage.control_read.get();
        let control = self.storage.control_codec.get();
        self.work.control_decode_attempts = control.decode_attempts;
        self.work.control_decodes = control.decodes;
        self.work.control_reemission_attempts = control.emission_attempts;
        self.work.control_reemissions = control.emissions;
        self.work.constructed_control_attempts = self.storage.constructed_control_attempts.get();
        self.work.constructed_control_emissions = self.storage.constructed_control_emissions.get();
        answer
    }
    fn delivery(&mut self, v: &Validated) -> Result<(), OpeningError> {
        self.run("deliver", |s, w| {
            s.barriers()?;
            pass(s, None, None, ReadKind::None, w, v.trace.capacity())?;
            Ok(())
        })
    }
    pub fn mutate(&mut self, input: &Request) -> Result<Vec<u8>, OpeningError> {
        let mut v = self.run("recover", |s, w| {
            pass(s, input.key.as_deref(), None, ReadKind::None, w, 0)
        })?;
        observation::field_attempt(0);
        if let Some(record) = v.matched.take() {
            observation::field_complete(true);
            observation::attempt(
                Boundary::OriginalInput,
                record.input_payload().max(input.payload()),
                16,
            );
            let equal = record.matches_input(input);
            observation::complete(Boundary::OriginalInput, equal);
            if !equal {
                return Err(OpeningError::Conflict);
            }
            if self.storage.profile() == Profile::Assessment {
                drop(std::mem::take(&mut v.keys));
                v.next = None;
                let reply = self.result_reply(&record)?;
                drop(record);
                if let Err(error) = self.delivery(&v) {
                    self.discard_reply();
                    return Err(error);
                }
                return Ok(reply);
            }
            self.delivery(&v)?;
            return self.result_reply(&record);
        }
        observation::field_complete(false);
        observation::field_attempt(0);
        if let Some(p) = &v.prefix.pending {
            observation::field_complete(true);
            observation::attempt(
                Boundary::KeyFeasibility,
                input
                    .key
                    .as_ref()
                    .map_or(0, String::len)
                    .max(p.input.key.as_ref().map_or(0, String::len)) as u64,
                1,
            );
            let same_key = p.input.key == input.key;
            observation::complete(Boundary::KeyFeasibility, same_key);
            if same_key {
                observation::attempt(
                    Boundary::OriginalInput,
                    p.input.payload().max(input.payload()),
                    16,
                );
                let equal = p.input == *input;
                observation::complete(Boundary::OriginalInput, equal);
                if !equal {
                    return Err(OpeningError::Conflict);
                }
            }
            observation::attempt(
                Boundary::OriginalInput,
                p.input.payload().max(input.payload()),
                16,
            );
            let equal = p.input == *input;
            observation::complete(Boundary::OriginalInput, equal);
            if !equal {
                return Err(OpeningError::Unavailable);
            }
        } else {
            observation::field_complete(false);
            observation::field_attempt(24);
            let unsupported = input.op == "open_change" && input.key.as_deref() != Some("open-1");
            observation::field_complete(!unsupported);
            if unsupported {
                return Err(OpeningError::Unsupported);
            }
            observation::field_attempt(26);
            let needs_intent = matches!(input.op.as_str(), "revise_intent" | "assess_intent");
            observation::field_complete(needs_intent);
            if needs_intent {
                observation::field_attempt(0);
                let present = v.prefix.generation != 0;
                observation::field_complete(present);
                if !present {
                    return Err(OpeningError::Unavailable);
                }
                observation::field_attempt(71);
                let current =
                    input.expected_intent.as_deref() == Some(logical(v.current_intent).as_str());
                observation::field_complete(current);
                if !current {
                    return Err(OpeningError::Conflict);
                }
            }
            observation::field_attempt(13);
            let assessment = input.op == "assess_intent";
            observation::field_complete(assessment);
            if assessment {
                observation::field_attempt(13);
                let known = input.check.as_deref() == Some(CHECK);
                observation::field_complete(known);
                if !known {
                    return Err(OpeningError::Unsupported);
                }
            }
            observation::field_attempt(0);
            let accepted_end = v.trace.len() as u64 == v.prefix.end;
            observation::field_complete(accepted_end);
            if !accepted_end {
                return Err(OpeningError::Unavailable);
            }
            observation::field_attempt(0);
            let full = v.prefix.generation == 128;
            observation::field_complete(!full);
            if full {
                return Err(OpeningError::Unsupported);
            }
        }
        let p = Pending {
            input: input.clone(),
            actor: "owner-1".into(),
        };
        let record = construct(
            &p,
            v.prefix.generation + 1,
            self.storage.profile(),
            v.current_intent,
            v.what_bytes,
        )
        .map_err(|_| OpeningError::Unavailable)?;
        let bytes = emit_record(&record, &mut self.work).map_err(|_| OpeningError::Unavailable)?;
        observation::field_attempt(0);
        let invalid_capacity = v
            .prefix
            .end
            .checked_add(bytes.len() as u64)
            .is_none_or(|n| n > ACCEPTED);
        observation::field_complete(!invalid_capacity);
        if invalid_capacity {
            return Err(OpeningError::Unsupported);
        }
        observation::field_attempt(0);
        let unreserved = v.prefix.pending.is_none();
        observation::field_complete(unreserved);
        if unreserved {
            let reserved = Prefix {
                pending: Some(p),
                ..v.prefix.clone()
            };
            self.run("reserve", |s, w| {
                let expected = feasible(
                    s.profile(),
                    (v.current_intent, v.what_bytes),
                    &v.prefix,
                    reserved.pending.as_ref().ok_or_else(Failure::damage)?,
                    &v.keys,
                    &v.trace,
                    w,
                )?;
                observation::attempt(
                    Boundary::Candidate,
                    expected.len().max(bytes.len()) as u64,
                    1,
                );
                let equal = expected == bytes;
                observation::complete(Boundary::Candidate, equal);
                if !equal {
                    return Err(Failure::damage());
                }
                s.replace_prefix(&reserved)?;
                let installed: Prefix = s.read_canonical("checkpoint.json")?;
                observation::attempt(
                    Boundary::ControlTyped,
                    installed.payload().max(reserved.payload()),
                    64,
                );
                let equal = installed == reserved;
                observation::complete(Boundary::ControlTyped, equal);
                if !equal {
                    return Err(Failure::damage());
                }
                Ok(())
            })?;
        }
        if self.storage.profile() == Profile::Assessment {
            drop(std::mem::take(&mut v.keys));
            v.next = None;
        }
        let successor = self.run("checkpoint", |_, w| successor(&v, &bytes, w))?;
        self.run("append", |s, _| {
            s.append(&bytes[v.trace.len() - v.prefix.end as usize..])?;
            s.sync_control("trace.jsonl")
        })?;
        // Profile 3 keeps one bounded withheld result, not an outer typed record
        // overlapping the decoded/reconstructed pair in post-commit passes.
        let withheld = if self.storage.profile() == Profile::Assessment {
            Some(self.result_reply(&record)?)
        } else {
            None
        };
        let legacy_record = if withheld.is_some() {
            drop(record);
            None
        } else {
            Some(record)
        };
        if withheld.is_some() {
            v.prefix.pending = None;
        }
        let committed = self.run("checkpoint", |s, w| {
            s.replace_prefix(&successor)?;
            pass(s, None, None, ReadKind::None, w, v.trace.capacity())?;
            Ok(())
        });
        if let Err(error) = committed {
            if withheld.is_some() {
                self.discard_reply();
            }
            return Err(error);
        }
        if let Err(error) = self.delivery(&v) {
            if withheld.is_some() {
                self.discard_reply();
            }
            return Err(error);
        }
        match withheld {
            Some(reply) => Ok(reply),
            None => self.result_reply(legacy_record.as_ref().ok_or(OpeningError::Unavailable)?),
        }
    }
    pub fn inspect(&mut self, at: Option<u64>) -> Result<Vec<u8>, OpeningError> {
        self.inspect_kind(at, ReadKind::Intent)
    }
    pub fn inspect_kind(
        &mut self,
        at: Option<u64>,
        read: ReadKind,
    ) -> Result<Vec<u8>, OpeningError> {
        let mut v = self.run("recover", |s, w| pass(s, None, at, read, w, 0))?;
        if self.storage.profile() == Profile::Assessment {
            drop(std::mem::take(&mut v.keys));
            v.next = None;
        }
        if self.storage.profile() == Profile::Assessment {
            observation::field_attempt(0);
            let record = match v.selected.take() {
                Some(record) => {
                    observation::field_complete(true);
                    record
                }
                None => {
                    observation::field_complete(false);
                    return Err(OpeningError::Unavailable);
                }
            };
            self.work.reply_emission_attempts += 1;
            let reply = emit_query(&Inspection {
                v: &v,
                record: &record,
                seq: match &record {
                    Record::Origin(r) => r.seq,
                    Record::Revision(r) => r.seq,
                    Record::Assessment(r) => r.seq,
                },
                profile: Profile::Assessment,
            })
            .map_err(|_| OpeningError::Unavailable)?;
            self.work.reply_emissions += 1;
            drop(record);
            if let Err(error) = self.delivery(&v) {
                self.discard_reply();
                return Err(error);
            }
            return Ok(reply);
        }
        observation::field_attempt(0);
        let record = match v.selected.as_ref() {
            Some(record) => {
                observation::field_complete(true);
                record
            }
            None => {
                observation::field_complete(false);
                return Err(OpeningError::Unavailable);
            }
        };
        self.delivery(&v)?;
        self.work.reply_emission_attempts += 1;
        let bytes = emit_query(&Inspection {
            v: &v,
            record,
            seq: match record {
                Record::Origin(r) => r.seq,
                Record::Revision(r) => r.seq,
                Record::Assessment(r) => r.seq,
            },
            profile: self.storage.profile(),
        })
        .map_err(|_| OpeningError::Unavailable)?;
        self.work.reply_emissions += 1;
        Ok(bytes)
    }
    fn result_reply(&mut self, record: &Record) -> Result<Vec<u8>, OpeningError> {
        self.work.reply_emission_attempts += 1;
        let bytes = record.result().map_err(|_| OpeningError::Unavailable)?;
        self.work.reply_emissions += 1;
        Ok(bytes)
    }
    pub fn request(&mut self, bytes: &[u8]) -> Result<Request, OpeningError> {
        self.work.request_decode_attempts += 1;
        let value: Request = decode(bytes).map_err(|_| OpeningError::InvalidInput)?;
        if !value.valid() {
            return Err(OpeningError::InvalidInput);
        }
        self.work.request_decodes += 1;
        Ok(value)
    }
    pub fn discard_reply(&mut self) {
        self.work.discarded_replies += 1;
    }
    pub fn error_reply(&mut self, error: OpeningError) -> Vec<u8> {
        self.work.reply_emission_attempts += 1;
        let bytes = error.json();
        self.work.reply_emissions += 1;
        self.work.error_replies += 1;
        bytes
    }
    pub fn delivery_cut(&mut self) -> Result<(), OpeningError> {
        self.run("deliver", |s, _| s.event("reply", "before").map(|_| ()))
    }
}
struct Inspection<'a> {
    v: &'a Validated,
    record: &'a Record,
    seq: u64,
    profile: Profile,
}
impl Serialize for Inspection<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        struct Coverage<'a> {
            p: &'a Prefix,
            seq: u64,
        }
        impl Serialize for Coverage<'_> {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut o = s.serialize_struct("coverage", 6)?;
                o.serialize_field("first", &1u64)?;
                o.serialize_field("last", &self.p.generation)?;
                o.serialize_field("sha256", &self.p.sha256.as_deref().unwrap_or_default())?;
                o.serialize_field("selected", &self.seq)?;
                o.serialize_field("returned", &1u64)?;
                o.serialize_field("complete", &true)?;
                o.end()
            }
        }
        let p = &self.v.prefix;
        let mut o = s.serialize_struct("intent_inspection", 13)?;
        observation::field_attempt(0);
        let assessment_read = matches!(self.record, Record::Assessment(_));
        observation::field_complete(assessment_read);
        o.serialize_field(
            "v",
            &if self.profile == Profile::Assessment {
                3u64
            } else {
                2u64
            },
        )?;
        o.serialize_field(
            "kind",
            if assessment_read {
                "assessment_inspection"
            } else {
                "intent_inspection"
            },
        )?;
        o.serialize_field("workspace_id", "workspace-1")?;
        o.serialize_field("change", "change-1")?;
        o.serialize_field(
            "projection",
            if assessment_read {
                "ck-assessment-view@1"
            } else if self.profile == Profile::Assessment {
                "ck-assessment-intent-view@1"
            } else {
                "ck-intent-view@1"
            },
        )?;
        o.serialize_field(
            "purpose",
            if assessment_read {
                "notice_payload"
            } else {
                "intent"
            },
        )?;
        o.serialize_field("origin", &logical(1))?;
        o.serialize_field("tip", &logical(p.generation))?;
        o.serialize_field("current_intent", &logical(self.v.current_intent))?;
        o.serialize_field(
            if assessment_read {
                "selected_assessment"
            } else {
                "selected_intent"
            },
            &logical(self.seq),
        )?;
        if let Record::Assessment(r) = self.record {
            observation::field_attempt(71);
            let current = r.result.intent == logical(self.v.current_intent);
            observation::field_complete(current);
            o.serialize_field(
                "applicability",
                if current { "current" } else { "historical" },
            )?;
        }
        o.serialize_field("record", self.record)?;
        o.serialize_field("coverage", &Coverage { p, seq: self.seq })?;
        observation::field_attempt(0);
        let pending = p.pending.is_some();
        observation::field_complete(pending);
        let progress = if pending {
            "blocked_pending"
        } else {
            observation::field_attempt(0);
            let tail = self.v.trace.len() as u64 > p.end;
            observation::field_complete(tail);
            if tail {
                "blocked_unaccepted_tail"
            } else {
                "ready"
            }
        };
        o.serialize_field("progress", progress)?;
        o.end()
    }
}
