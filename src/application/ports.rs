//! Capabilities consumed by change orchestration; concrete adapters are assembled in lib.rs.
use crate::kernel::change::intent::*;
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Grant {
    pub version: String,
    pub custody: String,
    pub ledger: String,
    pub change: String,
    pub owner: String,
    pub coverage: String,
    pub policy: Material,
    pub directory: String,
    pub anchor: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Previous {
    pub fact: Fact,
    pub what_text: String,
    pub why_text: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Review {
    pub format: String,
    pub input: Request,
    pub policy_text: String,
    pub previous: Option<Previous>,
    pub instruction_text: String,
    pub what_text: String,
    pub why_text: Option<String>,
}

impl Grant {
    pub fn validate(&self) -> Result<()> {
        if self.version != V || crate::VERSION != V {
            return Err(Error::Unsupported);
        }
        if self.custody != "custody-1"
            || self.ledger != "ledger-1"
            || self.change != "change-1"
            || self.owner != "person-1"
            || self.coverage != "closed-personal-plan"
            || self.policy != Material::of(POLICY.as_bytes())
        {
            return Err(Error::Unsupported);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContextCoverage {
    pub first: u64,
    pub last: u64,
    pub through: Option<Fact>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HistoryCoverage {
    pub first: u64,
    pub last: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Context {
    pub tip: Option<Fact>,
    pub at: Option<Fact>,
    pub intent: Option<Intent>,
    pub approval: Option<Material>,
    pub policy: Material,
    pub coverage: ContextCoverage,
    pub readiness: Vec<String>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct History {
    pub tip: Option<Fact>,
    pub through: Option<Fact>,
    pub records: Vec<Record>,
    pub coverage: HistoryCoverage,
    pub next_after: Option<u64>,
    pub readiness: Vec<String>,
}

pub enum Command {
    Connect {
        mode: String,
        grant: Grant,
        authorization: Lease,
    },
    Call {
        prepare: bool,
        authorization: Lease,
        request: Request,
    },
    Confirm {
        authorization: Lease,
        input: Request,
    },
    Close,
    Discard,
}
pub enum Response {
    Connected,
    Closed,
    Discarded,
    Prepared {
        input: Request,
        presentation: String,
    },
    Accepted(Outcome),
    Operation {
        key: String,
        status: String,
        result: Option<Outcome>,
        tip: Option<Fact>,
        readiness: Vec<String>,
    },
    Retained(Material),
    Resolved {
        material: Material,
        text: String,
    },
    Context(Context),
    History(History),
}

/// Exact encoding is consumed for approval identity and prospective reply bounds.
pub trait Encoding {
    fn response(&self, id: u64, response: &Response) -> Result<Vec<u8>>;
    fn review(&self, review: &Review) -> Result<String>;
    fn approval(&self, text: &str) -> Result<Receipt>;
    fn receipt(&self, receipt: &Receipt) -> Result<String>;
    fn subject(&self, request: &Request) -> Result<String>;
}
pub trait Materials {
    fn resolve(&self, material: &Material) -> Result<String>;
    fn policy(&self) -> Material;
}
pub trait ReadState {
    fn records(&self) -> &[Record];
    fn generation(&self) -> u64;
    fn pending(&self) -> Option<&Pending>;
    fn temporary_pending(&self) -> Option<&Option<Pending>>;
    fn readiness(&self) -> &[String];
    fn tip(&self) -> Option<Fact> {
        (self.generation() > 0).then(|| Fact::at(self.generation()))
    }
    fn accepted(&self, key: &str) -> Option<&Record> {
        self.records().iter().find(|r| r.input.key() == key)
    }
}
pub trait Persistence: Materials {
    type State: ReadState;
    fn snapshot(&self) -> Result<Self::State>;
    fn original_presentation(&self, pending: &Pending) -> Result<String>;
    fn preflight_materials(&self, texts: &[&str]) -> Result<()>;
    fn preflight_record(&self, state: &Self::State, record: &Record) -> Result<()>;
    fn retain_agent(&mut self, text: &str, state: &Self::State) -> Result<Material>;
    fn retain(&mut self, text: &str) -> Result<Material>;
    fn reserve_commit(
        &mut self,
        state: &Self::State,
        pending: Pending,
        lease: &Lease,
    ) -> Result<Record>;
    fn phase(&self, phase: &'static str);
    fn io_failed(&self) -> bool;
    fn quarantine(&mut self);
    fn finish_failure(&mut self);
}
pub trait Connect {
    type Store: Persistence;
    fn connect(&mut self, grant: Grant, mode: &str) -> Result<Self::Store>;
}
