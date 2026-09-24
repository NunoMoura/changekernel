//! Pure intake contracts. Text is never normalized or trimmed on retention.
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Issue {
    InvalidInput,
    Denied,
    Conflict,
    Unavailable,
}
pub type Result<T> = std::result::Result<T, Issue>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Proposal {
    pub container_id: String,
    pub request_id: String,
    pub what: String,
    pub why: Option<String>,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Receipt {
    pub change_id: String,
    pub container_id: String,
    pub request_id: String,
    pub actor: String,
    pub what: String,
    pub why: Option<String>,
    pub state: &'static str,
}

pub fn identifier(value: &str) -> bool {
    !value.trim().is_empty() && value.len() <= 256 && !value.chars().any(char::is_control)
}
pub fn validate(proposal: &Proposal) -> Result<()> {
    if !identifier(&proposal.container_id)
        || !identifier(&proposal.request_id)
        || proposal.what.trim().is_empty()
        || proposal.what.len() > 65_536
        || proposal.why.as_ref().is_some_and(|why| why.len() > 65_536)
    {
        return Err(Issue::InvalidInput);
    }
    Ok(())
}

// Versioned, domain-separated length-prefixed UTF-8 encoding; Option tag distinguishes absent/empty.
fn field(hash: &mut Sha256, value: &str) {
    hash.update((value.len() as u64).to_be_bytes());
    hash.update(value.as_bytes());
}
pub fn digest(domain: &str, fields: &[&str], why: Option<&str>) -> String {
    let mut hash = Sha256::new();
    field(&mut hash, "changekernel.native-intake.digest@1");
    field(&mut hash, domain);
    for value in fields {
        field(&mut hash, value);
    }
    if let Some(why) = why {
        hash.update([1]);
        field(&mut hash, why);
    } else {
        hash.update([0]);
    }
    format!("{:x}", hash.finalize())
}
pub fn change_id(container: &str, actor: &str, request: &str) -> String {
    digest("change", &[container, actor, request], None)
}
pub fn integrity(receipt: &Receipt) -> String {
    digest(
        "record",
        &[
            &receipt.change_id,
            &receipt.container_id,
            &receipt.actor,
            &receipt.request_id,
            &receipt.what,
            receipt.state,
        ],
        receipt.why.as_deref(),
    )
}
