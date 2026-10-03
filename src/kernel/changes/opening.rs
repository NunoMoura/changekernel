//! Values for the bounded, opening-only profile. Not native intake or admission.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Request {
    pub v: u64,
    pub op: String,
    pub workspace_id: String,
    pub change: String,
    pub key: Option<String>,
    pub what: Option<String>,
    pub why: Option<Option<String>>,
}
impl Request {
    pub fn valid(&self) -> bool {
        self.v == 1
            && identifier(&self.workspace_id)
            && identifier(&self.change)
            && match self.op.as_str() {
                "open_change" => {
                    self.key.as_deref().is_some_and(identifier)
                        && self
                            .what
                            .as_deref()
                            .is_some_and(|s| !s.trim().is_empty() && s.len() <= 65_536)
                        && self
                            .why
                            .as_ref()
                            .is_some_and(|s| s.as_ref().is_none_or(|s| s.len() <= 65_536))
                }
                "inspect_change" => self.key.is_none() && self.what.is_none() && self.why.is_none(),
                _ => false,
            }
    }
}
pub(crate) fn identifier(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Opened {
    pub v: u64,
    pub kind: String,
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
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: Option<String>,
    pub kind: String,
    pub input: Request,
    pub result: Opened,
}
/// Failure is not a lifecycle result and never proves that storage did not accept.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpeningError {
    InvalidInput,
    Denied,
    Conflict,
    Unavailable,
    Unsupported,
}
impl OpeningError {
    pub fn json(self) -> Vec<u8> {
        let code = match self {
            Self::InvalidInput => "invalid_input",
            Self::Denied => "denied",
            Self::Conflict => "conflict",
            Self::Unavailable => "unavailable",
            Self::Unsupported => "unsupported",
        };
        format!("{{\"v\":1,\"kind\":\"error\",\"code\":\"{code}\"}}\n").into_bytes()
    }
}
