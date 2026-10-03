//! Profile-selected sequential custody using the opening fixture's concrete syscalls.
mod codec;
use super::opening::{
    codec::{decode, emit, emit_query, retained_counted, RetainedWork, LIMIT},
    storage::{Failure, Profile, Storage},
    OpeningIoHook, OpeningMode, OpeningSlot,
};
use crate::kernel::changes::{
    intent_trace::{logical, Request, Revised, Revision},
    opening::{Opened, OpeningError, Origin},
};
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
}
impl Record {
    fn input(&self) -> Request {
        match self {
            Self::Origin(r) => Request::from_opening(r.input.clone()),
            Self::Revision(r) => r.input.clone(),
        }
    }
    fn key(&self) -> &str {
        match self {
            Self::Origin(r) => &r.result.key,
            Self::Revision(r) => &r.result.key,
        }
    }
    fn actor(&self) -> &str {
        match self {
            Self::Origin(r) => &r.result.actor,
            Self::Revision(r) => &r.result.actor,
        }
    }
    fn result(&self) -> Result<Vec<u8>, ()> {
        match self {
            Self::Origin(r) => emit(&r.result),
            Self::Revision(r) => emit(&r.result),
        }
    }
}
impl Serialize for Record {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Origin(r) => r.serialize(s),
            Self::Revision(r) => r.serialize(s),
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
    keys: Vec<String>,
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
fn construct(p: &Pending, seq: u64) -> Result<Record, Failure> {
    if p.actor != "owner-1"
        || !p.input.valid()
        || p.input.workspace_id != "workspace-1"
        || p.input.change != "change-1"
        || !(1..=128).contains(&seq)
    {
        return Err(Failure::damage());
    }
    let r = &p.input;
    if seq == 1 {
        if r.op != "open_change" || r.key.as_deref() != Some("open-1") {
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
        if r.op != "revise_intent"
            || r.expected_intent.as_deref() != Some(logical(seq - 1).as_str())
        {
            return Err(Failure::damage());
        }
        Ok(Record::Revision(Revision {
            v: 2,
            custody: "custody-1".into(),
            workspace_id: r.workspace_id.clone(),
            binding: "fixture@1".into(),
            change: r.change.clone(),
            seq,
            prev: logical(seq - 1),
            kind: "intent_revised".into(),
            input: r.clone(),
            result: Revised {
                v: 2,
                kind: "intent_revised".into(),
                workspace_id: r.workspace_id.clone(),
                change: r.change.clone(),
                key: r.key.clone().ok_or_else(Failure::damage)?,
                actor: p.actor.clone(),
                result: logical(seq),
                seq,
                intent: logical(seq),
                previous_intent: logical(seq - 1),
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
fn retained_record(line: &[u8], seq: u64, work: &mut IntentWork) -> Result<Record, Failure> {
    let mut counted = RetainedWork::default();
    let value = if seq == 1 {
        retained_counted(line, &mut counted).map(Record::Origin)
    } else {
        retained_counted(line, &mut counted).map(Record::Revision)
    };
    work.record_decode_attempts += counted.decode_attempts;
    work.record_decodes += counted.decodes;
    work.record_reemission_attempts += counted.emission_attempts;
    work.record_reemissions += counted.emissions;
    value.map_err(|_| Failure::damage())
}
fn feasible(
    prefix: &Prefix,
    p: &Pending,
    keys: &[String],
    trace: &[u8],
    work: &mut IntentWork,
) -> Result<Vec<u8>, Failure> {
    if prefix.generation >= 128
        || keys
            .iter()
            .any(|k| Some(k.as_str()) == p.input.key.as_deref())
    {
        return Err(Failure::damage());
    }
    let record = construct(
        p,
        prefix
            .generation
            .checked_add(1)
            .ok_or_else(Failure::damage)?,
    )?;
    let bytes = emit_record(&record, work).map_err(|_| Failure::damage())?;
    if bytes.is_empty()
        || prefix
            .end
            .checked_add(bytes.len() as u64)
            .is_none_or(|n| n > ACCEPTED)
        || !bytes.starts_with(&trace[prefix.end as usize..])
    {
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
            .filter(|n| *n <= ACCEPTED)
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
    work: &mut IntentWork,
    retained_trace: usize,
) -> Result<Validated, Failure> {
    work.passes += 1;
    s.identity()?;
    s.inventory(false)?;
    s.check_incident()?;
    let prefix: Prefix = s.read_canonical("checkpoint.json")?;
    if prefix.format != "ck-intent-prefix@2"
        || prefix.custody != "custody-1"
        || prefix.change != "change-1"
        || prefix.generation > 128
        || prefix.end > ACCEPTED
    {
        return Err(Failure::damage());
    }
    let trace = s.read("trace.jsonl", TOTAL)?;
    work.trace_buffers_peak = work
        .trace_buffers_peak
        .max(if retained_trace > 0 { 2 } else { 1 });
    work.trace_buffer_bytes_peak = work
        .trace_buffer_bytes_peak
        .max((trace.capacity() + retained_trace) as u64);
    if prefix.end > trace.len() as u64
        || (prefix.generation == 0 && (prefix.end != 0 || prefix.sha256.is_some()))
        || (prefix.generation > 0 && (prefix.end == 0 || prefix.sha256.is_none()))
    {
        return Err(Failure::damage());
    }
    let accepted = &trace[..prefix.end as usize];
    let mut hash = Sha256::new();
    hash.update(accepted);
    work.accepted_hash_bytes += accepted.len() as u64;
    if prefix.generation > 0
        && prefix.sha256.as_deref() != Some(format!("{:x}", hash.clone().finalize()).as_str())
    {
        return Err(Failure::damage());
    }
    let mut keys = Vec::new();
    let mut selected = None;
    let mut matched = None;
    let mut seq = 0;
    for line in accepted.split_inclusive(|b| *b == b'\n') {
        seq += 1;
        if seq > prefix.generation || line.len() > LIMIT {
            return Err(Failure::damage());
        }
        let record = retained_record(line, seq, work)?;
        if record
            != construct(
                &Pending {
                    input: record.input(),
                    actor: record.actor().into(),
                },
                seq,
            )?
            || keys.iter().any(|k| k == record.key())
        {
            return Err(Failure::damage());
        }
        keys.push(record.key().to_owned());
        if key == Some(record.key()) {
            matched = Some(record.clone());
        }
        if at.unwrap_or(prefix.generation) == seq {
            selected = Some(record);
        }
    }
    if seq != prefix.generation {
        return Err(Failure::damage());
    }
    let next = if let Some(p) = &prefix.pending {
        Some(feasible(&prefix, p, &keys, &trace, work)?)
    } else {
        if prefix.generation == 0 && !trace.is_empty() {
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
    };
    if s.exists("checkpoint.tmp")? {
        let temp: Prefix = s.read_canonical("checkpoint.tmp")?;
        let known = if temp == v.prefix {
            true
        } else if v.prefix.pending.is_none()
            && v.trace.len() as u64 == v.prefix.end
            && temp
                == (Prefix {
                    pending: temp.pending.clone(),
                    ..v.prefix.clone()
                })
        {
            if let Some(p) = &temp.pending {
                feasible(&v.prefix, p, &v.keys, &v.trace, work)?;
                true
            } else {
                false
            }
        } else if let Some(bytes) = &v.next {
            v.trace[v.prefix.end as usize..] == *bytes && temp == successor(&v, bytes, work)?
        } else {
            false
        };
        if !known {
            return Err(Failure::damage());
        }
        work.validated_prefixes += 1;
        s.remove("checkpoint.tmp")?;
        s.sync_directory()?;
        // Fresh post-cleanup validation; previous buffers are released before reread.
        drop(v);
        return pass(s, key, at, work, retained_trace);
    }
    work.validated_prefixes += 1;
    // Close interrupted cleanup's absent-temporary directory barrier too.
    s.sync_directory()?;
    Ok(v)
}
pub(crate) fn validate_connect(s: &mut Storage) -> Result<(), Failure> {
    pass(s, None, None, &mut IntentWork::default(), 0).map(|_| ())
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
        if self.storage.latched {
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
            pass(s, None, None, w, v.trace.capacity())?;
            Ok(())
        })
    }
    pub fn mutate(&mut self, input: &Request) -> Result<Vec<u8>, OpeningError> {
        let v = self.run("recover", |s, w| pass(s, input.key.as_deref(), None, w, 0))?;
        if let Some(record) = &v.matched {
            if record.input() != *input {
                return Err(OpeningError::Conflict);
            }
            self.delivery(&v)?;
            return self.result_reply(record);
        }
        if let Some(p) = &v.prefix.pending {
            if p.input.key == input.key && p.input != *input {
                return Err(OpeningError::Conflict);
            }
            if p.input != *input {
                return Err(OpeningError::Unavailable);
            }
        } else {
            if input.op == "open_change" && input.key.as_deref() != Some("open-1") {
                return Err(OpeningError::Unsupported);
            }
            if input.op == "revise_intent" {
                if v.prefix.generation == 0 {
                    return Err(OpeningError::Unavailable);
                }
                if input.expected_intent.as_deref() != Some(logical(v.prefix.generation).as_str()) {
                    return Err(OpeningError::Conflict);
                }
            }
            if v.trace.len() as u64 != v.prefix.end {
                return Err(OpeningError::Unavailable);
            }
            if v.prefix.generation == 128 {
                return Err(OpeningError::Unsupported);
            }
        }
        let p = Pending {
            input: input.clone(),
            actor: "owner-1".into(),
        };
        let record =
            construct(&p, v.prefix.generation + 1).map_err(|_| OpeningError::Unavailable)?;
        let bytes = emit_record(&record, &mut self.work).map_err(|_| OpeningError::Unavailable)?;
        if v.prefix
            .end
            .checked_add(bytes.len() as u64)
            .is_none_or(|n| n > ACCEPTED)
        {
            return Err(OpeningError::Unsupported);
        }
        if v.prefix.pending.is_none() {
            let reserved = Prefix {
                pending: Some(p),
                ..v.prefix.clone()
            };
            self.run("reserve", |s, w| {
                let expected = feasible(
                    &v.prefix,
                    reserved.pending.as_ref().ok_or_else(Failure::damage)?,
                    &v.keys,
                    &v.trace,
                    w,
                )?;
                if expected != bytes {
                    return Err(Failure::damage());
                }
                s.replace_prefix(&reserved)?;
                let installed: Prefix = s.read_canonical("checkpoint.json")?;
                if installed != reserved {
                    return Err(Failure::damage());
                }
                Ok(())
            })?;
        }
        let successor = self.run("checkpoint", |_, w| successor(&v, &bytes, w))?;
        self.run("append", |s, _| {
            s.append(&bytes[v.trace.len() - v.prefix.end as usize..])?;
            s.sync_control("trace.jsonl")
        })?;
        self.run("checkpoint", |s, w| {
            s.replace_prefix(&successor)?;
            pass(s, None, None, w, v.trace.capacity())?;
            Ok(())
        })?;
        self.delivery(&v)?;
        self.result_reply(&record)
    }
    pub fn inspect(&mut self, at: Option<u64>) -> Result<Vec<u8>, OpeningError> {
        let v = self.run("recover", |s, w| pass(s, None, at, w, 0))?;
        let record = v.selected.as_ref().ok_or(OpeningError::Unavailable)?;
        self.delivery(&v)?;
        self.work.reply_emission_attempts += 1;
        let bytes = emit_query(&Inspection {
            v: &v,
            record,
            seq: at.unwrap_or(v.prefix.generation),
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
        let value = decode(bytes).map_err(|_| OpeningError::InvalidInput)?;
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
        o.serialize_field("v", &2u64)?;
        o.serialize_field("kind", "intent_inspection")?;
        o.serialize_field("workspace_id", "workspace-1")?;
        o.serialize_field("change", "change-1")?;
        o.serialize_field("projection", "ck-intent-view@1")?;
        o.serialize_field("purpose", "intent")?;
        o.serialize_field("origin", &logical(1))?;
        o.serialize_field("tip", &logical(p.generation))?;
        o.serialize_field("current_intent", &logical(p.generation))?;
        o.serialize_field("selected_intent", &logical(self.seq))?;
        o.serialize_field("record", self.record)?;
        o.serialize_field("coverage", &Coverage { p, seq: self.seq })?;
        o.serialize_field(
            "progress",
            if p.pending.is_some() {
                "blocked_pending"
            } else if self.v.trace.len() as u64 > p.end {
                "blocked_unaccepted_tail"
            } else {
                "ready"
            },
        )?;
        o.end()
    }
}
