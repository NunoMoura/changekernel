//! Pure rules and values for the fixed legacy personal-intent profile.
use sha2::{Digest, Sha256};
#[cfg(test)]
mod tests;
pub const V: &str = "0.5.0-prototype.1";
pub const POLICY: &str = "{\"format\":\"ck-plan-policy\",\"owner\":\"person-1\",\"ledger\":\"ledger-1\",\"change\":\"change-1\",\"coverage\":\"closed-personal-plan\",\"actions\":[\"open_intent\",\"revise_intent\"],\"approval\":\"local-tui-exact\",\"domain_requirements\":[],\"relationships\":[],\"external_effects\":false}\n";
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid,
    Unsupported,
    Conflict,
    Denied,
    Unavailable,
}
pub type Result<T> = std::result::Result<T, Error>;
impl Error {
    pub fn code(self) -> &'static str {
        match self {
            Self::Invalid => "invalid_input",
            Self::Unsupported => "unsupported",
            Self::Conflict => "conflict",
            Self::Denied => "denied",
            Self::Unavailable => "unavailable",
        }
    }
}
pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn hex(s: &str, n: usize) -> bool {
    s.len() == n
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub fn key(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Material {
    pub custody: String,
    pub sha256: String,
    pub bytes: u64,
    pub text: String,
}

impl Material {
    pub fn of(bytes: &[u8]) -> Self {
        Self {
            custody: "custody-1".into(),
            sha256: hash(bytes),
            bytes: bytes.len() as u64,
            text: "utf8-exact".into(),
        }
    }
    pub fn valid(&self) -> bool {
        self.custody == "custody-1"
            && hex(&self.sha256, 64)
            && self.bytes <= 65_536
            && self.text == "utf8-exact"
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Fact {
    pub ledger: String,
    pub change: String,
    pub seq: u64,
}

impl Fact {
    pub fn at(seq: u64) -> Self {
        Self {
            ledger: "ledger-1".into(),
            change: "change-1".into(),
            seq,
        }
    }
    pub fn valid(&self) -> bool {
        self.ledger == "ledger-1" && self.change == "change-1" && (1..=128).contains(&self.seq)
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Intent {
    pub what: Material,
    pub why: Option<Material>,
}

impl Intent {
    pub fn valid(&self) -> bool {
        self.what.valid() && self.why.as_ref().is_none_or(Material::valid)
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Lease {
    pub principal: String,
    pub disclose: String,
    pub mutate: String,
}

impl Lease {
    pub fn check(&self, mutation: bool) -> Result<()> {
        if self.principal != "person-1"
            || ![&self.disclose, &self.mutate]
                .iter()
                .all(|s| matches!(s.as_str(), "allow" | "deny" | "unavailable"))
        {
            return Err(Error::Invalid);
        }
        for p in std::iter::once(&self.disclose).chain(mutation.then_some(&self.mutate)) {
            match p.as_str() {
                "allow" => {}
                "deny" => return Err(Error::Denied),
                _ => return Err(Error::Unavailable),
            }
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Request {
    pub op: String,
    pub key: Option<String>,
    pub expected: Option<Fact>,
    pub instruction: Option<Material>,
    pub replacement: Option<Intent>,
    pub text: Option<String>,
    pub at: Option<Fact>,
    pub through: Option<Fact>,
    pub after: Option<u64>,
    pub limit: Option<u64>,
    pub material: Option<Material>,
}
impl Request {
    pub fn mutation(&self) -> bool {
        matches!(self.op.as_str(), "open_intent" | "revise_intent")
    }
    pub fn key(&self) -> &str {
        self.key.as_deref().unwrap_or("")
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Record {
    pub version: String,
    pub custody: String,
    pub seq: u64,
    pub prev: Option<Fact>,
    pub input: Request,
    pub approval: Material,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Pending {
    pub input: Request,
    pub approval: Material,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Receipt {
    pub format: String,
    pub principal: String,
    pub subject_sha256: String,
    pub presentation: Material,
    pub decision: String,
    pub ui: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Outcome {
    pub format: String,
    pub version: String,
    pub kind: String,
    pub key: String,
    pub actor: String,
    pub fact: Fact,
    pub previous: Option<Fact>,
}

impl Record {
    pub fn outcome(&self) -> Outcome {
        Outcome {
            format: "ck-intent-result".into(),
            version: V.into(),
            kind: if self.seq == 1 {
                "opened"
            } else {
                "intent_revised"
            }
            .into(),
            key: self.input.key().into(),
            actor: "person-1".into(),
            fact: Fact::at(self.seq),
            previous: self.prev.clone(),
        }
    }
}

/// Legal progression of the fixed legacy profile, independent of storage and encoding.
pub fn prospective(p: &Pending, records: &[Record]) -> Result<Record> {
    let n = records.len() as u64 + 1;
    if n > 128
        || !p.input.mutation()
        || (n == 1 && p.input.op != "open_intent")
        || (n > 1 && (p.input.op != "revise_intent" || p.input.expected != Some(Fact::at(n - 1))))
        || records.iter().any(|r| r.input.key() == p.input.key())
    {
        return Err(Error::Unavailable);
    }
    Ok(Record {
        version: V.into(),
        custody: "custody-1".into(),
        seq: n,
        prev: (n > 1).then(|| Fact::at(n - 1)),
        input: p.input.clone(),
        approval: p.approval.clone(),
    })
}

/// Admission errors differ from corrupted-history errors; retain that distinction.
pub fn admit_new(r: &Request, generation: u64, tip: Option<Fact>) -> Result<()> {
    if r.op == "open_intent" {
        if generation != 0 {
            return Err(Error::Unsupported);
        }
    } else if tip.is_none() || r.expected != tip {
        return Err(Error::Conflict);
    }
    if generation == 128 {
        return Err(Error::Unsupported);
    }
    Ok(())
}

pub fn exact_input(expected: &Request, actual: &Request) -> Result<()> {
    if expected != actual {
        return Err(Error::Conflict);
    }
    Ok(())
}

/// Fixed local approval identity, checked before encoding the exact subject.
pub fn approval_principal(receipt: &Receipt) -> Result<()> {
    if receipt.format != "ck-local-approval" || receipt.principal != "person-1" {
        return Err(Error::Unavailable);
    }
    Ok(())
}

/// The caller supplies the identity of the exact encoded input, never a moving tip.
pub fn approval_subject(receipt: &Receipt, subject_sha256: &str) -> Result<()> {
    if receipt.subject_sha256 != subject_sha256 {
        return Err(Error::Unavailable);
    }
    approval_decision(receipt)
}

pub fn approval_decision(receipt: &Receipt) -> Result<()> {
    if receipt.decision != "adopt" || receipt.ui != "local-tui-exact" {
        return Err(Error::Unavailable);
    }
    Ok(())
}

/// Historical generated reviews bind their named predecessor, not the current tip.
pub fn historical_review_subject(r: &Request, previous: Option<&Fact>) -> Result<Option<Fact>> {
    match r.op.as_str() {
        "open_intent" if r.expected.is_none() && previous.is_none() => Ok(None),
        "revise_intent" => {
            let expected = r.expected.as_ref().ok_or(Error::Unavailable)?;
            if previous != Some(expected) {
                return Err(Error::Unavailable);
            }
            Ok(Some(expected.clone()))
        }
        _ => Err(Error::Unavailable),
    }
}

pub fn exact_presentation(expected: &str, actual: &str) -> Result<()> {
    if expected != actual {
        return Err(Error::Unavailable);
    }
    Ok(())
}

pub fn review_sources(instruction: &str, what: &str) -> Result<()> {
    if instruction.is_empty() || !what.chars().any(|c| !matches!(c, ' ' | '\t' | '\r' | '\n')) {
        return Err(Error::Invalid);
    }
    Ok(())
}
