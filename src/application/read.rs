//! Elementary reads over a verified original. No persistence, wire decoding or target fetching.
use super::operation_request::{OperationRequestProfile, CURRENT_PROFILE};
use super::records::StoredOperation;
use crate::kernel::change::{
    Accepted, ActorId, ChangeKey, Command, ContentKey, ContentReference, Evidence, GrantTarget,
    GrantUse, GroundId, GroundVersion, Identity, IntakeSnapshot, NativeConditions, OperationId,
    ScopeJudgment,
};
use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

/// A reason-free refusal never carries protected sizes, hashes or partial results.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum ReadRefusal {
    /// Current role/disclosure/source permission or exact membership could not be established.
    /// This carries no protected details and does not establish absence or nonacceptance.
    Denied,
    /// An anchor is absent/invalid, or the requested range, selector or bookmark is inconsistent.
    Invalid,
    /// The supplied current context or another checked consistency condition changed.
    Changed,
    /// Current source/retention evidence cannot be verified, including a busy lease,
    /// indeterminate cut, custody/integrity disagreement, I/O or native failure. Not absence.
    Unavailable,
    /// Caller limits or this read's resource ceilings prevent completion. No completeness,
    /// partial page or permission to skip the first oversized record follows.
    Limit,
    /// The original's stored layout/profile is outside this reader's supported subset.
    /// Unsupported read-wire versions are codec errors, not this refusal.
    Unsupported,
}
impl fmt::Display for ReadRefusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Denied => "read denied",
            Self::Invalid => "invalid read request or anchor",
            Self::Changed => "read context or consistency condition changed",
            Self::Unavailable => "read source unavailable",
            Self::Limit => "read limit exceeded",
            Self::Unsupported => "unsupported read source profile",
        })
    }
}
impl std::error::Error for ReadRefusal {}

/// Transport failure is not a refusal or an empty page.
#[derive(Clone, Debug, PartialEq, Eq)]
#[must_use]
pub enum ReadReply<T> {
    Returned(T),
    Refused(ReadRefusal),
}

/// Requested limits only tighten these enforced per-call maxima.
/// Cold entry is charged independently of the selected interval.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ReadLimits {
    /// Maximum records scanned in this page, including nonmatches; valid range 1..=256.
    pub scanned_records: usize,
    /// Maximum matching records returned in this page; valid range 1..=64.
    pub returned_records: usize,
    /// Complete encoded reply ceiling, including header, coverage and cursor; 64 bytes..=2 MiB.
    /// A smaller/invalid request can only receive a refusal if that frame fits its actual ceiling.
    pub reply_bytes: usize,
}
impl Default for ReadLimits {
    fn default() -> Self {
        Self {
            scanned_records: 32,
            returned_records: 16,
            reply_bytes: 1024 * 1024,
        }
    }
}
impl ReadLimits {
    pub(crate) fn validate(self) -> Result<(), ReadRefusal> {
        if self.scanned_records == 0
            || self.scanned_records > 256
            || self.returned_records == 0
            || self.returned_records > 64
            || self.reply_bytes < 64
            || self.reply_bytes > 2 * 1024 * 1024
        {
            return Err(ReadRefusal::Limit);
        }
        Ok(())
    }
}

/// Qualified logical original/profile binding. One original belongs to this Change under
/// this profile. Native custody identifiers remain private and are revalidated separately.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadSource {
    pub identity: Identity,
    pub profile: OperationRequestProfile,
}

/// Logical acceptance position. Only Beginning has no operation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangePosition {
    pub source: ReadSource,
    pub sequence: u64,
    pub operation: Option<OperationId>,
}

/// Exact anchors refuse rather than clamping to a nearby position.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum ChangeAnchor {
    Beginning,
    Current,
    Operation(OperationId),
    Sequence(u64),
}

/// A qualified reference to an accepted operation, not an ID-only route.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct OperationReference {
    pub change: ChangeKey,
    pub operation: OperationId,
}

/// The actual recorded actor in the recording Change; never the represented owner.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ActorReference {
    pub change: ChangeKey,
    pub actor: ActorId,
}

/// Reference selectors inspect recorded references only, without fetching targets.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[non_exhaustive]
pub enum QualifiedReference {
    Change(ChangeKey),
    Operation(OperationReference),
    Content(ContentKey),
    Membership(ContentReference),
    /// An observation recorded by this Change, not a claim that the GroundId was issued here.
    GroundObservation {
        change: ChangeKey,
        ground: GroundId,
        version: GroundVersion,
    },
}

/// Current A command meanings, not arbitrary string predicates.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[non_exhaustive]
pub enum OperationKind {
    Start,
    Propose,
    Assess,
    Decide,
    Retract,
    Reaffirm,
    SetGrant,
    RevokeGrant,
    Admit,
    Dispatch,
    Finding,
    Adapt,
    Progress,
    Fulfill,
    Withdraw,
    Reconcile,
}
impl OperationKind {
    pub(crate) fn of(command: &Command) -> Self {
        match command {
            Command::Initiate { .. } => Self::Start,
            Command::Propose { .. } => Self::Propose,
            Command::Assess { .. } => Self::Assess,
            Command::Decide(_) => Self::Decide,
            Command::Retract { .. } => Self::Retract,
            Command::Reaffirm { .. } => Self::Reaffirm,
            Command::SetGrant { .. } => Self::SetGrant,
            Command::RevokeGrant { .. } => Self::RevokeGrant,
            Command::Admit(_) => Self::Admit,
            Command::Dispatch { .. } => Self::Dispatch,
            Command::Finding { .. } => Self::Finding,
            Command::Adapt { .. } => Self::Adapt,
            Command::Progress { .. } => Self::Progress,
            Command::Fulfill(_) => Self::Fulfill,
            Command::Withdraw { .. } => Self::Withdraw,
            Command::Reconcile { .. } => Self::Reconcile,
        }
    }
}

/// Conjunction across fields on one record, alternatives within a nonempty field.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RecordMatch {
    pub kinds: BTreeSet<OperationKind>,
    pub operations: BTreeSet<OperationReference>,
    pub actors: BTreeSet<ActorReference>,
    pub references: BTreeSet<QualifiedReference>,
}
impl RecordMatch {
    fn validate(&self) -> Result<(), ReadRefusal> {
        let sizes = [
            self.kinds.len(),
            self.operations.len(),
            self.actors.len(),
            self.references.len(),
        ];
        if sizes.iter().all(|n| *n == 0) {
            return Err(ReadRefusal::Invalid);
        }
        if sizes.iter().any(|n| *n > 64) {
            return Err(ReadRefusal::Limit);
        }
        Ok(())
    }
    fn matches(&self, record: &StoredOperation) -> bool {
        let key = record.checks.identity.change_key();
        (self.kinds.is_empty()
            || self
                .kinds
                .contains(&OperationKind::of(&record.operation.command)))
            && (self.operations.is_empty()
                || self.operations.contains(&OperationReference {
                    change: key.clone(),
                    operation: record.operation.id.clone(),
                }))
            && (self.actors.is_empty()
                || self.actors.contains(&ActorReference {
                    change: key,
                    actor: record.accepted.actor.clone(),
                }))
            && (self.references.is_empty() || self.references.iter().any(|r| references(record, r)))
    }
}

/// Empty matching predicates are refused; all-selection is explicit.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RecordSelection {
    AllRecords,
    MatchingRecords(RecordMatch),
}

/// Fixed interval `(after, through]`, unaffected by subsequent appends.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangeRange {
    pub after: ChangePosition,
    pub through: ChangePosition,
}

/// Validated stateless bookmark. Fabricating one confers no access or prior coverage.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangePageCursor {
    pub range: ChangeRange,
    pub selection: RecordSelection,
    pub reader: ActorId,
    /// The public whole-history scope, not a private context token or a permission grant.
    pub permission_scope: ChangeKey,
    pub last_scanned: ChangePosition,
}

/// P34 history request. Source is additionally checked against the supplied local original.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReadChangeRequest {
    pub change: ChangeKey,
    pub range: ChangeRange,
    pub selection: RecordSelection,
    pub page_cursor: Option<ChangePageCursor>,
    pub limits: ReadLimits,
}

/// Per-membership provenance without retained payload or private acceptance controls.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PublicMembership {
    pub reference: ContentReference,
    pub intake: IntakeSnapshot,
    pub attributed_source: Option<ActorId>,
    pub derived_from: BTreeSet<ContentReference>,
    pub origin: Option<PublicOrigin>,
}

/// Accepted recording origin, not authorship or renewed permission.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PublicOrigin {
    pub grant: GrantUse,
    pub target: GrantTarget,
}

/// Faithful accepted meaning. Command contains references/terms/grants/outcomes, no payloads.
/// Raw Context/Checks, payload observations and grants used only as controls are excluded.
/// Accepted intake/source claims and actual ground-version observations remain public facts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PublicRecord {
    pub position: ChangePosition,
    pub command: Command,
    pub accepted: Accepted,
    pub used_grant: Option<GrantUse>,
    pub memberships: Vec<PublicMembership>,
    pub discretion_evidence: Option<Evidence>,
    pub native_evidence: Option<NativeConditions>,
    /// Actual checked versions, not merely the command's requested dependencies.
    pub ground_observations: BTreeMap<GroundId, GroundVersion>,
}
impl PublicRecord {
    pub(crate) fn from_stored(source: &ReadSource, record: &StoredOperation) -> Self {
        let mut memberships = Vec::with_capacity(record.checks.intakes.len());
        for (key, intake) in &record.checks.intakes {
            let fresh = record.operation.fresh.iter().find(|f| &f.key == key);
            let origin = record
                .checks
                .creation
                .as_ref()
                .and_then(|c| c.content_items.get(key));
            memberships.push(PublicMembership {
                reference: ContentReference {
                    identity: source.identity.clone(),
                    operation: record.operation.id.clone(),
                    content: key.clone(),
                },
                intake: intake.clone(),
                attributed_source: fresh.map(|f| f.attributed_source.clone()),
                derived_from: fresh.map(|f| f.derived_from.clone()).unwrap_or_default(),
                origin: origin.map(|o| PublicOrigin {
                    grant: o.origin.grant.clone(),
                    target: o.origin.target.clone(),
                }),
            });
        }
        Self {
            position: position(source, record.sequence, Some(record.operation.id.clone())),
            command: record.operation.command.clone(),
            accepted: record.accepted.clone(),
            used_grant: record.used_grant.clone(),
            memberships,
            discretion_evidence: record
                .checks
                .adaptation
                .as_ref()
                .and_then(|(_, j)| match j {
                    ScopeJudgment::WithinDiscretion(e) => Some(e.clone()),
                    ScopeJudgment::RequiresRevision | ScopeJudgment::Unavailable => None,
                }),
            native_evidence: record.checks.native.as_ref().map(|(_, n)| n.clone()),
            ground_observations: record.checks.grounds.clone(),
        }
    }
}

/// Scan progress, not consumption or a completeness assertion outside this fixed range.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ChangeProgress {
    More {
        next_page_cursor: Box<ChangePageCursor>,
    },
    EndOfRange,
}

/// Only this page's actual contiguous scan is coverage, even for a fabricated bookmark.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangePage {
    pub records: Vec<PublicRecord>,
    pub scanned: ChangeRange,
    pub observed_head: ChangePosition,
    pub progress: ChangeProgress,
}

pub(crate) fn position(
    source: &ReadSource,
    sequence: u64,
    operation: Option<OperationId>,
) -> ChangePosition {
    ChangePosition {
        source: source.clone(),
        sequence,
        operation,
    }
}

pub(crate) fn resolve(
    source: &ReadSource,
    records: &[StoredOperation],
    anchor: &ChangeAnchor,
) -> Result<ChangePosition, ReadRefusal> {
    if source.profile != CURRENT_PROFILE {
        return Err(ReadRefusal::Unsupported);
    }
    let sequence = match anchor {
        ChangeAnchor::Beginning => 0,
        ChangeAnchor::Current => records.len() as u64,
        ChangeAnchor::Sequence(n) => *n,
        ChangeAnchor::Operation(op) => records
            .iter()
            .find(|r| &r.operation.id == op)
            .map(|r| r.sequence)
            .ok_or(ReadRefusal::Invalid)?,
    };
    if sequence == 0 {
        return Ok(position(source, 0, None));
    }
    let index = usize::try_from(sequence - 1).map_err(|_| ReadRefusal::Invalid)?;
    let record = records.get(index).ok_or(ReadRefusal::Invalid)?;
    Ok(position(
        source,
        sequence,
        Some(record.operation.id.clone()),
    ))
}
fn validate_position(
    source: &ReadSource,
    records: &[StoredOperation],
    p: &ChangePosition,
) -> Result<(), ReadRefusal> {
    if *p != resolve(source, records, &ChangeAnchor::Sequence(p.sequence))? {
        return Err(ReadRefusal::Invalid);
    }
    Ok(())
}

/// Computes scan boundaries without copying a candidate record. The adapter must size the
/// complete encoded page before converting records or releasing any results.
pub(crate) fn scan(
    source: &ReadSource,
    records: &[StoredOperation],
    reader: &ActorId,
    request: &ReadChangeRequest,
    mut fits: impl FnMut(&[usize], usize) -> Result<bool, ReadRefusal>,
) -> Result<(Vec<usize>, usize, usize), ReadRefusal> {
    request.limits.validate()?;
    if request.change != source.identity.change_key() {
        return Err(ReadRefusal::Invalid);
    }
    validate_position(source, records, &request.range.after)?;
    validate_position(source, records, &request.range.through)?;
    if request.range.after.sequence > request.range.through.sequence {
        return Err(ReadRefusal::Invalid);
    }
    if let RecordSelection::MatchingRecords(m) = &request.selection {
        m.validate()?;
    }
    let start = match &request.page_cursor {
        None => request.range.after.sequence,
        Some(c) => {
            if c.range != request.range
                || c.selection != request.selection
                || &c.reader != reader
                || c.permission_scope != request.change
                || c.last_scanned.sequence < request.range.after.sequence
                || c.last_scanned.sequence > request.range.through.sequence
            {
                return Err(ReadRefusal::Invalid);
            }
            validate_position(source, records, &c.last_scanned)?;
            c.last_scanned.sequence
        }
    } as usize;
    let through = request.range.through.sequence as usize;
    let mut last = start;
    let mut selected = Vec::new();
    while last < through && last - start < request.limits.scanned_records {
        if selected.len() == request.limits.returned_records {
            break;
        }
        let record = &records[last];
        let matches = match &request.selection {
            RecordSelection::AllRecords => true,
            RecordSelection::MatchingRecords(m) => m.matches(record),
        };
        if matches {
            selected.push(last);
        }
        if !fits(&selected, last + 1)? {
            if matches {
                selected.pop();
            }
            if last == start || selected.is_empty() && matches {
                return Err(ReadRefusal::Limit);
            }
            break;
        }
        last += 1;
    }
    if !fits(&selected, last)? {
        return Err(ReadRefusal::Limit);
    }
    Ok((selected, start, last))
}

fn membership_matches(reference: &ContentReference, selected: &QualifiedReference) -> bool {
    match selected {
        QualifiedReference::Membership(r) => reference == r,
        QualifiedReference::Content(k) => &reference.content == k,
        QualifiedReference::Change(k) => {
            reference.identity.change_key() == *k || reference.content.establishing == *k
        }
        QualifiedReference::Operation(r) => {
            reference.identity.change_key() == r.change && reference.operation == r.operation
        }
        QualifiedReference::GroundObservation { .. } => false,
    }
}
fn references(record: &StoredOperation, selected: &QualifiedReference) -> bool {
    if let QualifiedReference::GroundObservation {
        change,
        ground,
        version,
    } = selected
    {
        return *change == record.checks.identity.change_key()
            && record.checks.grounds.get(ground) == Some(version);
    }
    // This visitor mirrors PublicRecord's semantic/provenance fields, not private Checks.
    // In particular a recorded membership is public even when it was an inherited input.
    if let QualifiedReference::Operation(r) = selected {
        if r.change == record.checks.identity.change_key()
            && r.operation == record.accepted.operation
        {
            return true;
        }
    }
    for (key, intake) in &record.checks.intakes {
        let matches = match selected {
            QualifiedReference::Content(k) => key == k,
            QualifiedReference::Change(k) => {
                &key.establishing == k || record.checks.identity.change_key() == *k
            }
            QualifiedReference::Membership(r) => {
                r.identity == record.checks.identity
                    && r.operation == record.operation.id
                    && &r.content == key
            }
            QualifiedReference::Operation(_) | QualifiedReference::GroundObservation { .. } => {
                false
            }
        };
        if matches {
            return true;
        }
        if intake
            .prior_establishment
            .as_ref()
            .is_some_and(|r| membership_matches(r, selected))
        {
            return true;
        }
        if let crate::kernel::change::BindingKnowledge::Known(key) =
            &intake.source_claim.binding_knowledge
        {
            match selected {
                QualifiedReference::Content(k) if key == k => return true,
                QualifiedReference::Change(k) if &key.establishing == k => return true,
                _ => {}
            }
        }
    }
    for fresh in &record.operation.fresh {
        if fresh
            .derived_from
            .iter()
            .any(|r| membership_matches(r, selected))
        {
            return true;
        }
    }
    if let Some(creation) = &record.checks.creation {
        for item in creation.content_items.values() {
            if target_matches(&record.checks.identity, &item.origin.target, selected) {
                return true;
            }
        }
    }
    match &record.operation.command {
        Command::Propose { proposal, .. } => {
            if let QualifiedReference::Change(k) = selected {
                if proposal.identity.change_key() == *k {
                    return true;
                }
            }
            let terms = &proposal.terms;
            for term in &terms.binding {
                if membership_matches(&term.statement, selected)
                    || term.context.iter().any(|r| membership_matches(r, selected))
                {
                    return true;
                }
            }
            if terms
                .context
                .iter()
                .any(|r| membership_matches(r, selected))
            {
                return true;
            }
            for criterion in &terms.criteria {
                if membership_matches(&criterion.definition, selected)
                    || criterion
                        .terms
                        .iter()
                        .any(|r| membership_matches(r, selected))
                {
                    return true;
                }
            }
            terms
                .unknowns
                .iter()
                .any(|u| u.affected.iter().any(|r| membership_matches(r, selected)))
        }
        Command::Progress { progress, .. } => progress
            .terms
            .iter()
            .any(|r| membership_matches(r, selected)),
        Command::SetGrant { spec, .. } => {
            if target_matches(&record.checks.identity, &spec.target, selected) {
                return true;
            }
            for selector in spec.content_origins.iter().chain(&spec.disclosure_origins) {
                if let crate::kernel::change::OriginSelector::Historical(origin) = selector {
                    if membership_matches(&origin.binding, selected)
                        || target_matches(&origin.binding.identity, &origin.target, selected)
                    {
                        return true;
                    }
                }
            }
            false
        }
        // These current commands' supported reference classes are the public memberships
        // already visited above. Local proposal/agreement/etc. leaves are not new predicates.
        Command::Initiate { .. }
        | Command::Assess { .. }
        | Command::Decide(_)
        | Command::Retract { .. }
        | Command::Reaffirm { .. }
        | Command::RevokeGrant { .. }
        | Command::Admit(_)
        | Command::Dispatch { .. }
        | Command::Finding { .. }
        | Command::Adapt { .. }
        | Command::Fulfill(_)
        | Command::Withdraw { .. }
        | Command::Reconcile { .. } => false,
    }
}
fn target_matches(
    identity: &Identity,
    target: &GrantTarget,
    selected: &QualifiedReference,
) -> bool {
    match (target, selected) {
        (
            GrantTarget::DraftCreation(change) | GrantTarget::Draft(change),
            QualifiedReference::Change(k),
        ) => identity.owner == k.owner && identity.ledger == k.ledger && change == &k.change,
        _ => false,
    }
}
