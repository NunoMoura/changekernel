//! Closed values for the fresh, opening-only collection profile.
use super::opening::identifier;
pub(crate) const C: usize = 1_048_576;
pub(crate) const T: usize = 2_097_152;
pub(crate) const L: usize = 65_536;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LedgerPair {
    pub change: String,
    pub custody: String,
}
/// Borrowed installation specification. Construction copies only bounded values;
/// oversized backing capacities never enter an owning connection descriptor.
pub struct LedgerGrantSpec<'a> {
    pub profile: &'a str,
    pub ledger: &'a str,
    pub custody: &'a str,
    pub owner: &'a str,
    pub workspace_id: &'a str,
    pub binding: &'a str,
    pub directory: &'a std::path::Path,
    pub anchor: &'a std::path::Path,
    pub grants: &'a [LedgerPair; 16],
}
#[derive(Clone, Debug)]
pub struct LedgerGrant {
    pub(crate) profile: String,
    pub(crate) ledger: String,
    pub(crate) custody: String,
    pub(crate) owner: String,
    pub(crate) workspace_id: String,
    pub(crate) binding: String,
    pub(crate) directory: std::path::PathBuf,
    pub(crate) anchor: std::path::PathBuf,
    pub(crate) grants: [LedgerPair; 16],
}
/// The sole owning ingress buffer. Invalid size/capacity is represented without
/// retaining the rejected allocation; dispatch still emits the stable error.
#[derive(Clone, Debug)]
pub struct LedgerInput {
    pub(crate) bytes: Option<Vec<u8>>,
}
impl LedgerInput {
    pub fn new(bytes: Vec<u8>) -> Self {
        Self {
            bytes: if bytes.len() <= C && bytes.capacity() <= C {
                Some(bytes)
            } else {
                None
            },
        }
    }
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_deref().unwrap_or(&[])
    }
    pub fn capacity(&self) -> usize {
        self.bytes.as_ref().map_or(0, Vec::capacity)
    }
}
impl LedgerGrant {
    pub fn new(s: LedgerGrantSpec<'_>) -> Result<Self, super::opening::OpeningError> {
        if s.profile != "ck-ledger@4"
            || !identifier(s.ledger)
            || !identifier(s.custody)
            || s.owner != "owner-1"
            || s.workspace_id != "workspace-1"
            || s.binding != "fixture@1"
            || !s.directory.is_absolute()
            || !s.anchor.is_absolute()
            || s.directory
                .to_str()
                .is_none_or(|p| p.len() + 13 > 4096 || p.chars().any(char::is_control))
            || s.anchor
                .to_str()
                .is_none_or(|p| p.len() > 4096 || p.chars().any(char::is_control))
            || !s.grants.iter().enumerate().all(|(i, p)| {
                identifier(&p.change)
                    && identifier(&p.custody)
                    && p.custody != s.custody
                    && s.grants[..i]
                        .iter()
                        .all(|q| q.change != p.change && q.custody != p.custody)
            })
        {
            return Err(super::opening::OpeningError::Unavailable);
        }
        Ok(Self {
            profile: s.profile.into(),
            ledger: s.ledger.into(),
            custody: s.custody.into(),
            owner: s.owner.into(),
            workspace_id: s.workspace_id.into(),
            binding: s.binding.into(),
            directory: s.directory.to_path_buf(),
            anchor: s.anchor.to_path_buf(),
            grants: std::array::from_fn(|i| s.grants[i].clone()),
        })
    }
    pub(crate) fn valid(&self) -> bool {
        self.profile == "ck-ledger@4"
            && identifier(&self.ledger)
            && identifier(&self.custody)
            && self.owner == "owner-1"
            && self.workspace_id == "workspace-1"
            && self.binding == "fixture@1"
            && self.grants.iter().enumerate().all(|(i, p)| {
                identifier(&p.change)
                    && identifier(&p.custody)
                    && p.custody != self.custody
                    && self.grants[..i]
                        .iter()
                        .all(|q| q.change != p.change && q.custody != p.custody)
            })
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Cursor {
    pub v: u64,
    pub ledger: String,
    pub workspace_id: String,
    pub after: String,
    pub limit: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Request {
    pub v: u64,
    pub op: String,
    pub ledger: String,
    pub workspace_id: String,
    pub key: Option<String>,
    pub what: Option<String>,
    pub why: Option<Option<String>>,
    pub limit: Option<u64>,
    pub cursor: Option<Option<Cursor>>,
    pub change: Option<String>,
}
impl Request {
    pub(crate) fn valid(&self, mut observe: impl FnMut(usize, usize, Option<bool>)) -> bool {
        macro_rules! field {
            ($bytes:expr,$test:expr) => {{
                observe($bytes, 1, None);
                let ok = $test;
                observe($bytes, 1, Some(ok));
                ok
            }};
        }
        macro_rules! id {
            ($s:expr) => {{
                let s = $s;
                field!(0, !s.is_empty() && s.len() <= 64) && field!(s.len(), identifier(s))
            }};
        }
        if !field!(0, self.v == 4)
            || !id!(&self.ledger)
            || !id!(&self.workspace_id)
            || !field!(0, self.op.len() <= 14)
        {
            return false;
        }
        // Include the closed operation dispatch and its selected equality
        // alternatives, not just the possibly empty/short received word.
        macro_rules! operation {
            ($words:expr, $value:expr) => {{
                let bytes = self.op.len().max("inspect_change".len());
                observe(bytes, $words, None);
                let ok = $value;
                observe(bytes, $words, Some(ok));
                ok
            }};
        }
        match self.op.as_str() {
            "create_change" => {
                operation!(5,self.op=="create_change")
                &&field!(0,self.key.is_some())&&id!(self.key.as_deref().unwrap())
                &&field!(0,self.what.is_some())
                &&field!(0,self.what.as_ref().unwrap().len()<=L)
                // Nonblank is a scalar result of UTF-8 lexical validation,
                // not equality of What with a copied candidate string.
                &&field!(0,!self.what.as_ref().unwrap().trim().is_empty())
                &&field!(0,self.why.as_ref().is_some_and(|s|s.as_ref().is_none_or(|s|s.len()<=L)))
                &&field!(0,self.limit.is_none())&&field!(0,self.cursor.is_none())&&field!(0,self.change.is_none())
            }
            "list_changes" => {
                operation!(5, self.op == "list_changes")
                    && field!(0, self.key.is_none())
                    && field!(0, self.what.is_none())
                    && field!(0, self.why.is_none())
                    && field!(0, self.limit.is_some_and(|n| (1..=4).contains(&n)))
                    && field!(0, self.change.is_none())
                    && field!(0, self.cursor.is_some())
                    && self.cursor.as_ref().unwrap().as_ref().is_none_or(|c| {
                        field!(0, c.v == 4)
                            && id!(&c.ledger)
                            && id!(&c.workspace_id)
                            && id!(&c.after)
                            && field!(0, (1..=4).contains(&c.limit))
                    })
            }
            "select_change" | "inspect_change" => {
                operation!(
                    6,
                    matches!(self.op.as_str(), "select_change" | "inspect_change")
                ) && field!(0, self.key.is_none())
                    && field!(0, self.what.is_none())
                    && field!(0, self.why.is_none())
                    && field!(0, self.limit.is_none())
                    && field!(0, self.cursor.is_none())
                    && field!(0, self.change.is_some())
                    && id!(self.change.as_deref().unwrap())
            }
            _ => operation!(4, false),
        }
    }
    pub(crate) fn payload(&self) -> usize {
        self.op.len()
            + self.ledger.len()
            + self.workspace_id.len()
            + self.key.as_ref().map_or(0, String::len)
            + self.what.as_ref().map_or(0, String::len)
            + self
                .why
                .as_ref()
                .and_then(Option::as_ref)
                .map_or(0, String::len)
            + self.change.as_ref().map_or(0, String::len)
            + self
                .cursor
                .as_ref()
                .and_then(Option::as_ref)
                .map_or(0, |c| c.ledger.len() + c.workspace_id.len() + c.after.len())
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Created {
    pub v: u64,
    pub kind: String,
    pub ledger: String,
    pub workspace_id: String,
    pub change: String,
    pub key: String,
    pub actor: String,
    pub result: String,
    pub seq: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Origin {
    pub v: u64,
    pub custody: String,
    pub ledger: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: Option<String>,
    pub kind: String,
    pub input: Request,
    pub result: Created,
}
