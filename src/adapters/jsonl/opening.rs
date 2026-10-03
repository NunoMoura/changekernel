//! Concrete Linux custody for the consumed opening profile. No public raw append.
pub(super) mod codec;
pub(super) mod storage;
use crate::kernel::changes::opening::{Opened, OpeningError, Origin, Request};
use codec::Inspection;
pub(crate) use codec::{decode, emit};
use codec::{Anchor, Pending, Prefix};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use storage::{Failure, Storage};

/// Independently supplied trusted-host installation grant. Neither path is client input.
/// The profile pins custody-1/workspace-1/fixture@1/change-1/owner-1/open-1.
#[derive(Clone, Debug)]
pub struct OpeningSlot {
    pub directory: PathBuf,
    pub anchor: PathBuf,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpeningMode {
    FreshProvision,
    ResumeProvision,
    Reopen,
}
/// Concrete syscall observation seam for the trusted source-test host only.
/// A hook may terminate its own test process at a cut. Never expose through JSON.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OpeningIoEvent {
    pub phase: &'static str,
    pub object: &'static str,
    pub step: &'static str,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpeningIoFault {
    Continue,
    Io,
    ShortWrite,
}
pub type OpeningIoHook = Box<dyn FnMut(OpeningIoEvent) -> OpeningIoFault>;

pub(crate) struct Custody {
    storage: Storage,
}
impl Custody {
    pub fn connect(
        slot: OpeningSlot,
        mode: OpeningMode,
        hook: Option<OpeningIoHook>,
    ) -> Result<Self, OpeningError> {
        Storage::connect(slot, mode, hook)
            .map(|storage| Self { storage })
            .map_err(|_| OpeningError::Unavailable)
    }
    fn run<T>(
        &mut self,
        phase: &'static str,
        f: impl FnOnce(&mut Storage) -> Result<T, Failure>,
    ) -> Result<T, OpeningError> {
        if self.storage.latched {
            return Err(OpeningError::Unavailable);
        }
        self.storage.phase = phase;
        match f(&mut self.storage) {
            Ok(v) => Ok(v),
            Err(e) => {
                self.storage.retain_failure(&e);
                Err(OpeningError::Unavailable)
            }
        }
    }
    pub fn open(&mut self, input: &Request) -> Result<Opened, OpeningError> {
        // All lookup is downstream of the application authorization and subject check.
        let (prefix, trace) = self.run("recover", validate)?;
        // A new key is unsupported, never a route around damaged original grounds.
        if input.key.as_deref() != Some("open-1") {
            return Err(OpeningError::Unsupported);
        }
        if prefix.generation == 1 {
            let origin = selected(&prefix, &trace)?;
            if origin.input != *input {
                return Err(OpeningError::Conflict);
            }
            self.run("deliver", |s| {
                s.barriers()?;
                validate(s)?;
                Ok(())
            })?;
            return Ok(origin.result);
        }
        if let Some(pending) = &prefix.pending {
            if pending.input != *input {
                return Err(OpeningError::Conflict);
            }
        }
        let pending = Pending {
            input: input.clone(),
            actor: "owner-1".into(),
        };
        if prefix.pending.is_none() {
            let reserved = Prefix {
                pending: Some(pending.clone()),
                ..prefix.clone()
            };
            self.run("reserve", |s| s.replace_prefix(&reserved))?;
        }
        let origin = origin(&pending);
        let bytes = codec::emit(&origin).map_err(|_| OpeningError::Unavailable)?;
        let prefix = Prefix {
            generation: 1,
            end: bytes.len() as u64,
            sha256: Some(digest(&bytes)),
            pending: None,
            ..prefix
        };
        self.run("append", |s| {
            s.append(&bytes[trace.len()..])?;
            s.sync_control("trace.jsonl")
        })?;
        self.run("checkpoint", |s| {
            s.replace_prefix(&prefix)?;
            validate(s)?;
            Ok(())
        })?;
        self.run("deliver", |s| {
            s.barriers()?;
            validate(s)?;
            Ok(())
        })?;
        Ok(origin.result)
    }
    pub fn inspect(&mut self) -> Result<Vec<u8>, OpeningError> {
        let (prefix, trace) = self.run("recover", validate)?;
        let origin = selected(&prefix, &trace)?;
        self.run("deliver", |s| {
            s.barriers()?;
            validate(s)?;
            Ok(())
        })?;
        codec::emit(&Inspection {
            origin: &origin,
            tail: trace.len() as u64 > prefix.end,
        })
        .map_err(|_| OpeningError::Unavailable)
    }
    pub fn delivery_cut(&mut self) -> Result<(), OpeningError> {
        self.run("deliver", |s| {
            s.event("reply", "before")?;
            Ok(())
        })
    }
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn origin(pending: &Pending) -> Origin {
    let input = &pending.input;
    Origin {
        v: 1,
        custody: "custody-1".into(),
        workspace_id: "workspace-1".into(),
        binding: "fixture@1".into(),
        change: "change-1".into(),
        seq: 1,
        prev: None,
        kind: "opened".into(),
        input: input.clone(),
        result: Opened {
            v: 1,
            kind: "opened".into(),
            workspace_id: input.workspace_id.clone(),
            change: input.change.clone(),
            key: input.key.clone().unwrap_or_default(),
            actor: pending.actor.clone(),
            result: format!("{}:origin", input.change),
            seq: 1,
        },
    }
}
fn valid_pending(p: &Pending) -> bool {
    p.actor == "owner-1"
        && p.input.valid()
        && p.input.op == "open_change"
        && p.input.workspace_id == "workspace-1"
        && p.input.change == "change-1"
        && p.input.key.as_deref() == Some("open-1")
}
fn selected(prefix: &Prefix, trace: &[u8]) -> Result<Origin, OpeningError> {
    if prefix.generation != 1
        || prefix.end == 0
        || prefix.end > trace.len() as u64
        || prefix.end > codec::LIMIT as u64
    {
        return Err(OpeningError::Unavailable);
    }
    let bytes = &trace[..prefix.end as usize];
    if prefix.sha256.as_deref() != Some(&digest(bytes)) || prefix.pending.is_some() {
        return Err(OpeningError::Unavailable);
    }
    let record: Origin = codec::retained(bytes).map_err(|_| OpeningError::Unavailable)?;
    let pending = Pending {
        input: record.input.clone(),
        actor: record.result.actor.clone(),
    };
    if !valid_pending(&pending) || record != origin(&pending) {
        return Err(OpeningError::Unavailable);
    }
    Ok(record)
}
fn validate(s: &mut Storage) -> Result<(Prefix, Vec<u8>), Failure> {
    s.identity()?;
    s.inventory(false)?;
    s.check_incident()?;
    let prefix: Prefix = s.read_canonical("checkpoint.json")?;
    if prefix.format != "ck-opening-prefix@1"
        || prefix.custody != "custody-1"
        || prefix.change != "change-1"
    {
        return Err(Failure::damage());
    }
    let trace = s.read("trace.jsonl", 2_097_152)?;
    match prefix.generation {
        0 => {
            if prefix.end != 0 || prefix.sha256.is_some() {
                return Err(Failure::damage());
            }
            if let Some(pending) = &prefix.pending {
                if !valid_pending(pending) {
                    return Err(Failure::damage());
                }
                let bytes = codec::emit(&origin(pending)).map_err(|_| Failure::damage())?;
                if !bytes.starts_with(&trace) {
                    return Err(Failure::damage());
                }
            } else if !trace.is_empty() {
                return Err(Failure::damage());
            }
        }
        1 => {
            selected(&prefix, &trace).map_err(|_| Failure::damage())?;
        }
        _ => return Err(Failure::damage()),
    }
    if s.exists("checkpoint.tmp")? {
        let temp: Prefix = s.read_canonical("checkpoint.tmp")?;
        // Only the installed value or its proven single-step successor is a known remnant.
        let known = temp == prefix
            || if prefix.generation == 0 {
                if prefix.pending.is_none() && trace.is_empty() {
                    temp == Prefix {
                        pending: temp.pending.clone(),
                        ..prefix.clone()
                    } && temp.pending.as_ref().is_some_and(valid_pending)
                } else if let Some(p) = &prefix.pending {
                    let bytes = codec::emit(&origin(p)).map_err(|_| Failure::damage())?;
                    trace == bytes
                        && temp
                            == Prefix {
                                generation: 1,
                                end: bytes.len() as u64,
                                sha256: Some(digest(&bytes)),
                                pending: None,
                                ..prefix.clone()
                            }
                } else {
                    false
                }
            } else {
                false
            };
        if !known {
            return Err(Failure::damage());
        }
        s.remove("checkpoint.tmp")?;
        s.sync_directory()?;
    }
    Ok((prefix, trace))
}
fn initial_prefix() -> Prefix {
    Prefix {
        format: "ck-opening-prefix@1".into(),
        custody: "custody-1".into(),
        change: "change-1".into(),
        generation: 0,
        end: 0,
        sha256: None,
        pending: None,
    }
}
fn anchor_matches(a: &Anchor, slot: &OpeningSlot) -> bool {
    a.format == "ck-opening-anchor@1"
        && a.custody == "custody-1"
        && a.workspace_id == "workspace-1"
        && a.binding == "fixture@1"
        && a.change == "change-1"
        && a.owner == "owner-1"
        && a.key == "open-1"
        && Some(a.directory.as_str()) == slot.directory.to_str()
        && matches!(a.stage.as_str(), "preparing" | "installed")
}
