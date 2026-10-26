//! Current-format, explicitly unqualified application operations over supplied trusted ports.
//! There is no store, host authentication, dispatch implementation or supported SDK here.
use super::pursuit_ports::*;
use crate::kernel::change::pursuit::*;
use std::collections::BTreeMap;

use super::pursuit_records::*;
use super::submission::Submission;
mod history;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SubmissionError {
    /// Validation/source/disclosure refusal. This says nothing about an earlier submission
    /// with this ID; denied original-result lookup never establishes noncommit.
    Refused(Error),
    /// The trusted acceptance cut authoritatively established noncommit of this unchanged
    /// original request, not merely a refused lookup or conflicting candidate append.
    NotAccepted(Error),
    Indeterminate,
    /// This handle cannot establish a current prefix. Reopen the same store and reconstruct.
    Fenced,
}
impl From<Error> for SubmissionError {
    fn from(error: Error) -> Self {
        Self::Refused(error)
    }
}

pub struct Pursuit {
    state: State,
    records: BTreeMap<OperationId, StoredOperation>,
    fenced: bool,
}
impl Pursuit {
    /// New empty subject after explicit trusted store creation, not an accepted draft or grant.
    /// Never substitute this for a missing/damaged/unsupported store during opening.
    pub fn new(identity: Identity) -> Result<Self> {
        Ok(Self {
            state: State::new(identity)?,
            records: BTreeMap::new(),
            fenced: false,
        })
    }

    fn context(&self, ports: &mut impl Ports, disclosure: ReadScope) -> Result<Checks> {
        let context = ports.context()?;
        if context.authority.represented_owner != self.state.identity.owner {
            return Err(Error::Denied);
        }
        let disclosure_origin = match &disclosure {
            ReadScope::Material(id) => self.state.created.get(id).map(|r| r.origin.scope()),
            _ => None,
        };
        if !context
            .disclosure
            .contains(&ReadScope::Change(self.state.identity.change.clone()))
            && !context.disclosure.contains(&disclosure)
            && !disclosure_origin.as_ref().is_some_and(|origin| {
                context
                    .disclosure
                    .contains(&ReadScope::Origin(origin.clone()))
            })
        {
            return Err(Error::Denied);
        }
        Ok(Checks {
            identity: self.state.identity.clone(),
            expected_operation: self.state.last_operation.clone(),
            context,
            disclosure,
            disclosure_origin,
            creation: None,
            materials: BTreeMap::new(),
            grounds: BTreeMap::new(),
            adaptation: None,
            native: None,
        })
    }
    fn material(&self, ports: &mut impl Ports, checks: &mut Checks, id: &MaterialId) -> Result<()> {
        let bytes =
            if let Some(created) = checks.creation.as_ref().and_then(|c| c.materials.get(id)) {
                created.payload.bytes.clone()
            } else {
                ports.material(id)?
            };
        if self
            .state
            .materials
            .get(id)
            .is_some_and(|old| old != &bytes)
            || checks.materials.get(id).is_some_and(|old| old != &bytes)
        {
            return Err(Error::Conflict);
        }
        checks.materials.insert(id.clone(), bytes);
        Ok(())
    }
    fn proposal_references(&self, operation: &Operation, checks: &Checks) -> Result<()> {
        let Command::Propose { proposal, .. } = &operation.command else {
            return Ok(());
        };
        for reference in proposal.terms.references() {
            if reference.identity != self.state.identity {
                return Err(Error::Invalid);
            }
            // This map is the original acceptance snapshot, never latest material presence.
            // Own bindings are private checks until the guarded operation is accepted atomically.
            let bindings = if reference.operation == operation.id {
                &checks.materials
            } else {
                &self
                    .records
                    .get(&reference.operation)
                    .ok_or(Error::Invalid)?
                    .checks
                    .materials
            };
            let original = bindings.get(&reference.material).ok_or(Error::Invalid)?;
            if checks.materials.get(&reference.material) != Some(original) {
                return Err(Error::Conflict);
            }
        }
        Ok(())
    }
    fn evidence(
        &self,
        ports: &mut impl Ports,
        checks: &mut Checks,
        items: &[Evidence],
    ) -> Result<()> {
        for item in items {
            self.material(ports, checks, &item.material)?;
            self.material(ports, checks, &item.limitations)?;
        }
        Ok(())
    }
    fn validation(checks: &Checks) -> Validation {
        Validation {
            authority: checks.context.authority.clone(),
            materials: checks.materials.keys().cloned().collect(),
            fresh: checks
                .creation
                .as_ref()
                .map(|c| c.materials.keys().cloned().collect())
                .unwrap_or_default(),
            grounds: checks.grounds.clone(),
            scope: checks.adaptation.as_ref().map(|(_, s)| s.clone()),
            native: checks.native.as_ref().map(|(_, n)| n.clone()),
        }
    }
    /// Plans on a private candidate. Rejection leaves all accepted application state unchanged.
    /// Only Ports::accept may establish acceptance; its guarded revalidation contract is required.
    pub fn execute(
        &mut self,
        submission: Submission,
        ports: &mut impl Ports,
    ) -> std::result::Result<Accepted, SubmissionError> {
        if self.fenced {
            return Err(SubmissionError::Fenced);
        }
        if !submission.profile.is_current() || submission.target != self.state.identity.change_key()
        {
            return Err(Error::Conflict.into());
        }
        let operation = submission.operation.clone();
        let mut checks = self.context(ports, ReadScope::Operation(operation.id.clone()))?;
        if submission.actor != checks.context.authority.actor
            || submission.represented_owner != checks.context.authority.represented_owner
        {
            return Err(Error::Denied.into());
        }
        if let Some(original) = self.records.get(&operation.id) {
            if original.submission()? != submission {
                return Err(Error::Conflict.into());
            }
            // Recover the original result, never re-execute under refreshed authority or grounds.
            // Rebinding a retained identity is still an integrity conflict, even on exact retry.
            for id in original.checks.materials.keys() {
                self.material(ports, &mut checks, id)?;
            }
            ports.disclose(&checks)?;
            return Ok(original.accepted.clone());
        }
        checks.creation = self
            .state
            .prepare_creation(&operation, &checks.context.authority)?;
        let (materials, grounds) = self.state.requirements(&operation.command)?;
        for id in materials {
            self.material(ports, &mut checks, &id)?;
        }
        for id in grounds {
            checks.grounds.insert(id.clone(), ports.ground(&id)?);
        }
        if let Command::Adapt { adaptation, .. } = &operation.command {
            let judgment = ports.discretion(adaptation)?;
            if let ScopeJudgment::WithinDiscretion(evidence) = &judgment {
                self.evidence(ports, &mut checks, std::slice::from_ref(evidence))?;
            }
            checks.adaptation = Some((adaptation.clone(), judgment));
        }
        let action = match &operation.command {
            Command::Admit(action) => Some(action),
            Command::Dispatch { action } => Some(self.state.action_request(action)?),
            _ => None,
        };
        if let Some(action) = action {
            let conditions = ports.native_conditions(action)?;
            self.evidence(ports, &mut checks, &conditions.evidence)?;
            checks.native = Some((action.clone(), conditions));
        }
        // Extra payloads would create an implicit ingestion endpoint. Only actual bindings
        // of this complete operation (including trusted judgment inputs) may be fresh.
        if operation
            .fresh
            .iter()
            .any(|p| !checks.materials.contains_key(&p.id))
        {
            return Err(Error::Invalid.into());
        }
        let (mut candidate, effect) = self.candidate_current(&operation, &checks)?;
        if checks.creation.is_some() {
            ports.authorize_creation(&checks, &operation)?;
        }
        let accepted = Accepted {
            operation: operation.id.clone(),
            actor: checks.context.authority.actor.clone(),
            represented_owner: checks.context.authority.represented_owner.clone(),
            effect,
        };
        let used_grant = used_grant(&operation.command, &candidate);
        let grant_snapshot = used_grant
            .as_ref()
            .and_then(|g| candidate.grants.get(&g.id))
            .cloned();
        let record = StoredOperation {
            profile: submission.profile,
            sequence: u64::try_from(self.records.len())
                .map_err(|_| Error::Invalid)?
                .checked_add(1)
                .ok_or(Error::Invalid)?,
            creations: self.state.creation_claims(&operation),
            retained_materials: self.state.retained_bindings(&operation, &checks),
            operation: operation.clone(),
            accepted: accepted.clone(),
            checks: checks.clone(),
            used_grant,
            grant_snapshot,
        };
        if record.submission()? != submission {
            return Err(Error::Invalid.into());
        }
        Self::retain(&mut candidate, &record);
        // No fallible validation or transition remains after this serialization point.
        match ports.accept(&record) {
            Acceptance::Accepted => {}
            Acceptance::Refused(error) => return Err(SubmissionError::Refused(error)),
            Acceptance::NotAccepted(error) => return Err(SubmissionError::NotAccepted(error)),
            Acceptance::Indeterminate => {
                self.fenced = true;
                return Err(SubmissionError::Indeterminate);
            }
        }
        self.state = candidate;
        self.records.insert(operation.id, record);
        Ok(accepted)
    }
    pub fn read(&self, query: Query, access: Access, ports: &mut impl Ports) -> Result<Read> {
        if self.fenced {
            return Err(Error::Unavailable);
        }
        let scope = match &query {
            Query::Material(id) => ReadScope::Material(id.clone()),
            Query::Operation(id) => ReadScope::Operation(id.clone()),
            Query::Status => ReadScope::Change(self.state.identity.change.clone()),
            Query::Action(id) => ReadScope::Action(id.clone()),
        };
        let mut checks = self.context(ports, scope)?;
        let material = if let Query::Material(id) = &query {
            Some(id)
        } else {
            None
        };
        if let Query::Action(id) = &query {
            self.state
                .read_action_access(&access, id, &Self::validation(&checks))?;
        } else {
            self.state
                .read_access(&access, material, &Self::validation(&checks))?;
        }
        let result = match query {
            Query::Status => Read::Status(self.state.status()),
            Query::Operation(id) => {
                if let Some(record) = self.records.get(&id) {
                    for id in record.checks.materials.keys() {
                        self.material(ports, &mut checks, id)?;
                    }
                }
                Read::Operation(self.records.get(&id).map(|r| r.accepted.clone()))
            }
            Query::Material(id) => {
                if !self.state.materials.contains_key(&id) {
                    return Err(Error::Invalid);
                }
                self.material(ports, &mut checks, &id)?;
                Read::Material(checks.materials.get(&id).ok_or(Error::Unavailable)?.clone())
            }
            Query::Action(id) => {
                Read::Action(self.state.actions.get(&id).ok_or(Error::Invalid)?.clone())
            }
        };
        ports.disclose(&checks)?;
        Ok(result)
    }
    /// Owner inspection of original authority/acceptance grounds. No reconstruction from latest context.
    pub fn record(
        &self,
        id: &OperationId,
        ports: &mut impl Ports,
    ) -> Result<Option<StoredOperation>> {
        if self.fenced {
            return Err(Error::Unavailable);
        }
        let mut checks = self.context(ports, ReadScope::Operation(id.clone()))?;
        self.state
            .read_access(&Access::Owner, None, &Self::validation(&checks))?;
        if let Some(record) = self.records.get(id) {
            for id in record.checks.materials.keys() {
                self.material(ports, &mut checks, id)?;
            }
        }
        ports.disclose(&checks)?;
        Ok(self.records.get(id).cloned())
    }
}
fn used_grant(command: &Command, state: &State) -> Option<GrantUse> {
    match command {
        Command::Initiate {
            access: Access::Grant(g),
            ..
        }
        | Command::Propose {
            access: Access::Grant(g),
            ..
        }
        | Command::Assess {
            access: Access::Grant(g),
            ..
        }
        | Command::Finding {
            access: Access::Grant(g),
            ..
        }
        | Command::Adapt {
            access: Access::Grant(g),
            ..
        }
        | Command::Progress {
            access: Access::Grant(g),
            ..
        }
        | Command::Reconcile { grant: g, .. } => Some(g.clone()),
        Command::Admit(a) => Some(a.grant.clone()),
        Command::Dispatch { action } => state.actions.get(action).map(|a| a.request.grant.clone()),
        _ => None,
    }
}
