//! Independently admitted, opaque v6 composition values.
use super::{ledger::LedgerPair, opening::OpeningError};
use crate::adapters::jsonl::ledger::{
    continuity::LedgerContinuityCall,
    work::{self, Boundary as B, Heap, Owned},
};
use std::path::{Path, PathBuf};
pub(crate) const C: usize = 1_048_576;
pub struct LedgerContinuityGrantSpec<'a> {
    pub profile: &'a str,
    pub ledger: &'a str,
    pub custody: &'a str,
    pub owner: &'a str,
    pub workspace_id: &'a str,
    pub binding: &'a str,
    pub directory: &'a Path,
    pub anchor: &'a Path,
    pub grants: &'a [LedgerPair; 16],
    pub policy: &'a str,
    pub check: &'a str,
    pub evaluator: &'a str,
    pub adopter: &'a str,
}
#[derive(Debug)]
pub struct LedgerContinuityGrant {
    pub(crate) profile: String,
    pub(crate) ledger: String,
    pub(crate) custody: String,
    pub(crate) owner: String,
    pub(crate) workspace_id: String,
    pub(crate) binding: String,
    pub(crate) directory: PathBuf,
    pub(crate) anchor: PathBuf,
    pub(crate) grants: [LedgerPair; 16],
    pub(crate) policy: String,
    pub(crate) check: String,
    pub(crate) evaluator: String,
    pub(crate) adopter: String,
}
pub struct LedgerContinuityInput {
    pub(crate) bytes: Option<Vec<u8>>,
    pub(crate) supplied_len: usize,
    pub(crate) supplied_capacity: usize,
}
impl std::fmt::Debug for LedgerContinuityInput {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LedgerContinuityInput")
            .field("admitted", &self.bytes.is_some())
            .field("supplied_len", &self.supplied_len)
            .field("supplied_capacity", &self.supplied_capacity)
            .finish()
    }
}
impl LedgerContinuityInput {
    pub fn new(bytes: &mut Vec<u8>) -> Self {
        work::continuity_begin(LedgerContinuityCall::Input, 0);
        work::fixed_baseline(std::mem::size_of::<Self>());
        let supplied_len = bytes.len();
        let supplied_capacity = bytes.capacity();
        work::update(|w| {
            w.supplied_input_bytes = supplied_len as u64;
            w.supplied_input_capacity = supplied_capacity as u64;
        });
        let valid = work::test(B::InputAdmission, 0, 2, || {
            supplied_len <= C && supplied_capacity <= C
        });
        let value = if valid {
            Some(Owned::constructed(|| std::mem::take(bytes)).into_inner())
        } else {
            None
        };
        let input = Self {
            bytes: value,
            supplied_len,
            supplied_capacity,
        };
        work::continuity_seal();
        input
    }
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_deref().unwrap_or(&[])
    }
    pub fn capacity(&self) -> usize {
        self.bytes.as_ref().map_or(0, Vec::capacity)
    }
}
impl Heap for LedgerContinuityGrant {
    fn heap(&self) -> usize {
        self.profile.heap()
            + self.ledger.heap()
            + self.custody.heap()
            + self.owner.heap()
            + self.workspace_id.heap()
            + self.binding.heap()
            + self.directory.heap()
            + self.anchor.heap()
            + self.grants.heap()
            + self.policy.heap()
            + self.check.heap()
            + self.evaluator.heap()
            + self.adopter.heap()
    }
}
fn scalar(n: usize, max: usize) -> bool {
    work::test(B::Fields, 0, 1, || n <= max)
}
fn exact(value: &str, expected: &str) -> bool {
    scalar(value.len(), expected.len())
        && work::test(B::Fields, value.len().max(expected.len()), 1, || {
            value == expected
        })
}
pub(crate) fn id(value: &str) -> bool {
    scalar(value.len(), 64)
        && work::test(B::Fields, 0, 1, || !value.is_empty())
        && work::test(B::Fields, value.len(), 1, || {
            super::opening::identifier(value)
        })
}
fn path(value: &Path, reserve: usize) -> bool {
    let raw = value.as_os_str();
    if !scalar(raw.len(), 4096 - reserve) {
        return false;
    }
    work::attempt(B::Fields, raw.len(), 1);
    let text = value.to_str();
    work::complete(B::Fields, text.is_some());
    let Some(s) = text else {
        return false;
    };
    if !work::test(B::Fields, 1, 1, || s.starts_with('/'))
        || !work::test(B::Fields, 0, 1, || s.len() > 1)
        || !work::test(B::Fields, 1, 1, || !s.ends_with('/'))
    {
        return false;
    }
    for c in s.chars() {
        if !work::test(B::Fields, 0, 1, || !c.is_control()) {
            return false;
        }
    }
    // Each lexical component enters its own reached predicates. Path does not
    // normalize doubled separators or dot components into an admitted spelling.
    for part in s[1..].split('/') {
        if !work::test(B::Fields, 0, 1, || !part.is_empty())
            || !work::test(B::Fields, part.len().max(1), 1, || part != ".")
            || !work::test(B::Fields, part.len().max(2), 1, || part != "..")
        {
            return false;
        }
    }
    true
}

impl LedgerContinuityGrant {
    pub fn new(s: LedgerContinuityGrantSpec<'_>) -> Result<Self, OpeningError> {
        work::continuity_begin(LedgerContinuityCall::Grant, 0);
        work::fixed_baseline(std::mem::size_of::<LedgerContinuityGrantSpec<'_>>());
        work::attempt(B::GrantAdmission, 0, 14);
        let result = (|| {
            for (n, max) in [
                (s.profile.len(), "ck-ledger-continuity@6".len()),
                (s.ledger.len(), 64),
                (s.custody.len(), 64),
                (s.owner.len(), 7),
                (s.workspace_id.len(), 11),
                (s.binding.len(), 9),
                (s.directory.as_os_str().len(), 4083),
                (s.anchor.as_os_str().len(), 4096),
                (s.policy.len(), 16),
                (s.check.len(), 13),
                (s.evaluator.len(), 13),
                (s.adopter.len(), 7),
            ] {
                if !scalar(n, max) {
                    return Err(OpeningError::Unavailable);
                }
            }
            for p in s.grants {
                if !scalar(p.change.len(), 64) || !scalar(p.custody.len(), 64) {
                    return Err(OpeningError::Unavailable);
                }
            }
            if !(exact(s.profile, "ck-ledger-continuity@6")
                && id(s.ledger)
                && id(s.custody)
                && exact(s.owner, "owner-1")
                && exact(s.workspace_id, "workspace-1")
                && exact(s.binding, "fixture@1")
                && path(s.directory, 13)
                && path(s.anchor, 0)
                && exact(s.policy, "fixture-notice@1")
                && exact(s.check, "notice-what@1")
                && exact(s.evaluator, "utf8-length@1")
                && exact(s.adopter, "owner-1"))
            {
                return Err(OpeningError::Unavailable);
            }
            if !work::test(
                B::Fields,
                s.directory.as_os_str().len() + s.anchor.as_os_str().len().max(10),
                4,
                || {
                    !s.anchor.starts_with(s.directory)
                        && s.anchor.file_name().is_some_and(|n| n != "anchor.tmp")
                },
            ) {
                return Err(OpeningError::Unavailable);
            }
            for (i, p) in s.grants.iter().enumerate() {
                if !id(&p.change)
                    || !id(&p.custody)
                    || !work::test(
                        B::Identifiers,
                        p.custody.len().max(s.custody.len()),
                        1,
                        || p.custody != s.custody,
                    )
                {
                    return Err(OpeningError::Unavailable);
                }
                for q in &s.grants[..i] {
                    if !work::test(
                        B::Identifiers,
                        p.change.len().max(q.change.len()) + p.custody.len().max(q.custody.len()),
                        2,
                        || p.change != q.change && p.custody != q.custody,
                    ) {
                        return Err(OpeningError::Unavailable);
                    }
                }
            }
            let grant = Owned::constructed(|| Self {
                profile: s.profile.into(),
                ledger: s.ledger.into(),
                custody: s.custody.into(),
                owner: s.owner.into(),
                workspace_id: s.workspace_id.into(),
                binding: s.binding.into(),
                directory: s.directory.into(),
                anchor: s.anchor.into(),
                grants: std::array::from_fn(|i| LedgerPair {
                    change: s.grants[i].change.as_str().into(),
                    custody: s.grants[i].custody.as_str().into(),
                }),
                policy: s.policy.into(),
                check: s.check.into(),
                evaluator: s.evaluator.into(),
                adopter: s.adopter.into(),
            });
            work::update(|w| w.grant_vectors_peak = 1);
            Ok(grant.into_inner())
        })();
        work::complete(B::GrantAdmission, result.is_ok());
        if result.is_err() {
            work::attempt(B::Errors, 0, 1);
            work::complete(B::Errors, true);
        }
        work::continuity_seal();
        result
    }
}
