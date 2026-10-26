//! Versioned original records and derived collision claims, not a wire codec or ID registry.
use super::pursuit_ports::Checks;
use super::submission::{Submission, SubmissionProfile};
use crate::kernel::change::pursuit::*;
use std::collections::BTreeSet;

/// Core historical meaning, independent of adapter codec/schema versions.
pub const HISTORY_VERSION: u32 = 2;

/// Entity identities are scoped by type within owner/Ledger/Change.
/// Material claims remain conservatively unqualified in this bounded implementation;
/// they do not implement establishing-Change material identity or foreign intake.
/// Established actors/owner/Ledger and opaque scope/ground/context identifiers are references,
/// not resources created or authenticated here. Change creation is the store's explicit intake.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum CreatedIdentity {
    Operation(OperationId),
    Proposal(ProposalId),
    Agreement(AgreementId),
    Assessment(AssessmentId),
    Decision(DecisionId),
    Grant(GrantId),
    Action(ActionId),
    Criterion(CriterionId),
    Material(MaterialId),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StoredOperation {
    /// Exact original declaration, never recomputed from current codec/schema constants.
    pub profile: SubmissionProfile,
    /// One-based position within this Change, independent of ID ordering.
    pub sequence: u64,
    pub operation: Operation,
    pub accepted: Accepted,
    /// Original exact capabilities, membership/bytes, creation origins/usage, dependent versions
    /// and judgments. Historical assertions are not renewed approval or native evidence.
    pub checks: Checks,
    pub used_grant: Option<GrantUse>,
    pub grant_snapshot: Option<Grant>,
    /// Derived from the preceding state, never caller-declared authority. The store must check
    /// entity claims atomically within the full ChangeKey. Exact retry bypasses creation;
    /// grant updates and exact criterion reuse is not new creation. Material claims here
    /// cover fresh payload IDs only.
    pub creations: BTreeSet<CreatedIdentity>,
    /// First local bindings of nonfresh, established material IDs. These are NOT identity
    /// creation claims. Known immutable reuse is a trusted fixture premise in this unqualified
    /// representation, not a foreign-origin verifier or equal-bytes provenance proof.
    /// Exact bytes are in checks.materials; storage may reuse an authorized
    /// immutable binding from another Change, preserving its original provenance. If absent,
    /// retain the externally established binding without inventing a fresh-material origin.
    /// A different binding under an established ID conflicts; fresh payloads always require
    /// conservative owner-bound-Ledger material absence, including earlier nonfresh retention
    /// of equal bytes. This safeguard is not qualified material/intake conformance.
    pub retained_materials: BTreeSet<MaterialId>,
}

/// The store must verify this control independently against the authoritative accepted prefix.
/// An absent/damaged store must never be represented as a valid empty head. Copies/reconstruction
/// confer no writer authority. Retain the full original profile; independent original raw-byte
/// integrity and custody verification still belong to storage.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HistoryHead {
    pub profile: SubmissionProfile,
    pub identity: Identity,
    pub accepted_operations: u64,
    pub last_operation: Option<OperationId>,
}

impl StoredOperation {
    /// Recover the retained declaration, not fresh authority or a valid-history certificate.
    /// Profile is copied verbatim even if no longer supported; callers must refuse unsupported
    /// inputs rather than silently relabel them. Bound identity/prefix controls remain required.
    pub fn submission(&self) -> Result<Submission> {
        let authority = &self.checks.context.authority;
        if self.accepted.operation != self.operation.id
            || self.accepted.actor != authority.actor
            || self.accepted.represented_owner != authority.represented_owner
            || authority.represented_owner != self.checks.identity.owner
        {
            return Err(Error::Invalid);
        }
        Ok(Submission {
            profile: self.profile,
            target: self.checks.identity.change_key(),
            actor: self.accepted.actor.clone(),
            represented_owner: self.accepted.represented_owner.clone(),
            operation: self.operation.clone(),
        })
    }
}

impl State {
    pub(super) fn creation_claims(&self, operation: &Operation) -> BTreeSet<CreatedIdentity> {
        let mut out = BTreeSet::from([CreatedIdentity::Operation(operation.id.clone())]);
        match &operation.command {
            Command::Propose { proposal: p, .. } => {
                out.insert(CreatedIdentity::Proposal(p.id.clone()));
                out.insert(CreatedIdentity::Agreement(p.agreement.clone()));
                for c in &p.terms.criteria {
                    if !self
                        .proposals
                        .values()
                        .flat_map(|p| &p.terms.criteria)
                        .any(|old| old.id == c.id)
                    {
                        out.insert(CreatedIdentity::Criterion(c.id.clone()));
                    }
                }
            }
            Command::Assess { assessment, .. } => {
                out.insert(CreatedIdentity::Assessment(assessment.id.clone()));
            }
            Command::Decide(d) => {
                out.insert(CreatedIdentity::Decision(d.id.clone()));
            }
            Command::SetGrant { id, .. } if !self.grants.contains_key(id) => {
                out.insert(CreatedIdentity::Grant(id.clone()));
            }
            Command::Admit(a) => {
                out.insert(CreatedIdentity::Action(a.id.clone()));
            }
            _ => {}
        }
        out.extend(
            operation
                .fresh
                .iter()
                .map(|p| CreatedIdentity::Material(p.id.clone())),
        );
        out
    }
    pub(super) fn retained_bindings(
        &self,
        operation: &Operation,
        checks: &Checks,
    ) -> BTreeSet<MaterialId> {
        let fresh: BTreeSet<_> = operation.fresh.iter().map(|p| &p.id).collect();
        checks
            .materials
            .keys()
            .filter(|id| !self.materials.contains_key(*id) && !fresh.contains(id))
            .cloned()
            .collect()
    }
}
