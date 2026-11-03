//! Current-format local qualified-content operations over supplied trusted ports.
//! There is no store, host authentication, dispatch implementation or supported SDK here.
use super::operation_request::OperationRequest;
use super::ports::{Acceptance, Checks, IntakeRequest, Ports, Query, Read, ReadScope};
use super::records::{HistoryHead, StoredOperation};
use crate::kernel::change::{
    Accepted, Access, Attribution, BindingKnowledge, Command, ContentEstablishment, ContentKey,
    ContentReference, Effect, Error, Evidence, GrantUse, Identity, InputKind, IntakeCase,
    IntakeSnapshot, Operation, OperationId, Result, ScopeJudgment, State, Validation,
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OperationRequestError {
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
impl From<Error> for OperationRequestError {
    fn from(error: Error) -> Self {
        Self::Refused(error)
    }
}

pub struct Change {
    state: State,
    records: BTreeMap<OperationId, StoredOperation>,
    fenced: bool,
}
impl Change {
    /// New empty subject after explicit trusted store creation, not an accepted draft or grant.
    /// Never substitute this for a missing/damaged/unsupported store during opening.
    pub fn try_new(identity: Identity) -> Result<Self> {
        Ok(Self {
            state: State::try_new(identity)?,
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
            ReadScope::Content(id) => self.state.created.get(id).map(|r| r.origin.scope()),
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
            content_items: BTreeMap::new(),
            intakes: BTreeMap::new(),
            grounds: BTreeMap::new(),
            adaptation: None,
            native: None,
        })
    }
    fn content(
        &self,
        ports: &mut impl Ports,
        checks: &mut Checks,
        operation: Option<&Operation>,
        key: &ContentKey,
    ) -> Result<()> {
        if checks.content_items.contains_key(key) {
            return Ok(());
        }
        if key.establishing != self.state.identity.change_key() {
            return Err(Error::Unavailable);
        }
        let request = if let Some(payload) =
            operation.and_then(|op| op.fresh.iter().find(|p| &p.key == key))
        {
            IntakeRequest::Fresh(payload.clone())
        } else if operation.is_some_and(|op| op.first_retention.contains(key)) {
            IntakeRequest::FirstRetention(key.clone())
        } else {
            if !self.state.established.contains_key(key) {
                return Err(Error::Invalid);
            }
            IntakeRequest::KnownReuse(key.clone())
        };
        let observation = ports.resolve_content(checks, &request)?;
        let snapshot = IntakeSnapshot {
            case: match request {
                IntakeRequest::Fresh(_) => IntakeCase::Fresh,
                IntakeRequest::FirstRetention(_) => IntakeCase::FirstRetention,
                IntakeRequest::KnownReuse(_) => IntakeCase::KnownReuse,
            },
            source_claim: observation.source_claim,
            prior_establishment: self.state.established.get(key).map(|e| e.binding.clone()),
        };
        self.check_intake(operation, key, &observation.bytes, &snapshot)?;
        checks.content_items.insert(key.clone(), observation.bytes);
        checks.intakes.insert(key.clone(), snapshot);
        Ok(())
    }
    /// Shared live/restoration checks. Original establishment snapshots are immutable;
    /// current KnownReuse observations must match stable facts, not original knowledge/kind.
    fn check_intake(
        &self,
        operation: Option<&Operation>,
        key: &ContentKey,
        bytes: &[u8],
        snapshot: &IntakeSnapshot,
    ) -> Result<()> {
        if key.establishing != self.state.identity.change_key() {
            return Err(Error::Unavailable);
        }
        let source = &snapshot.source_claim;
        match snapshot.case {
            IntakeCase::Fresh => {
                let payload = operation
                    .and_then(|op| op.fresh.iter().find(|p| &p.key == key))
                    .ok_or(Error::Invalid)?;
                if self.state.established.contains_key(key) {
                    return Err(Error::Conflict);
                }
                if source.binding_knowledge != BindingKnowledge::NoKnownBinding {
                    return Err(Error::Conflict);
                }
                if source.input_kind != InputKind::NewContribution || bytes != payload.bytes {
                    return Err(Error::Conflict);
                }
                if snapshot.prior_establishment.is_some() {
                    return Err(Error::Invalid);
                }
                if source.attribution != Attribution::Actor(payload.attributed_source.clone()) {
                    return Err(Error::Denied);
                }
            }
            IntakeCase::FirstRetention => {
                if !operation.is_some_and(|op| op.first_retention.contains(key)) {
                    return Err(Error::Invalid);
                }
                if self.state.established.contains_key(key) {
                    return Err(Error::Conflict);
                }
                if source.binding_knowledge != BindingKnowledge::NoKnownBinding {
                    return Err(Error::Conflict);
                }
                if snapshot.prior_establishment.is_some()
                    || source.input_kind != InputKind::PreExisting
                {
                    return Err(Error::Invalid);
                }
            }
            IntakeCase::KnownReuse => {
                let established = self.state.established.get(key).ok_or(Error::Unavailable)?;
                if snapshot.prior_establishment.as_ref() != Some(&established.binding)
                    || source.binding_knowledge != BindingKnowledge::Known(key.clone())
                    || source.input_kind != InputKind::PreExisting
                    || self.state.content_items.get(key).map(Vec::as_slice) != Some(bytes)
                    || !source.same_stable_facts(&established.original.source_claim)
                {
                    return Err(Error::Conflict);
                }
            }
        }
        Ok(())
    }
    fn derivation_references(&self, operation: &Operation, checks: &Checks) -> Result<()> {
        for reference in operation.fresh.iter().flat_map(|p| &p.derived_from) {
            if reference.identity != self.state.identity || reference.operation == operation.id {
                return Err(Error::Invalid);
            }
            if reference.content.establishing != self.state.identity.change_key() {
                return Err(Error::Unavailable);
            }
            let original = self
                .records
                .get(&reference.operation)
                .ok_or(Error::Invalid)?;
            if !original
                .checks
                .content_items
                .contains_key(&reference.content)
                || original.checks.content_items.get(&reference.content)
                    != checks.content_items.get(&reference.content)
            {
                return Err(Error::Conflict);
            }
        }
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
            // This map is the original acceptance snapshot, never latest content presence.
            // Own bindings are private checks until the guarded operation is accepted atomically.
            let bindings = if reference.operation == operation.id {
                &checks.content_items
            } else {
                &self
                    .records
                    .get(&reference.operation)
                    .ok_or(Error::Invalid)?
                    .checks
                    .content_items
            };
            let original = bindings.get(&reference.content).ok_or(Error::Invalid)?;
            if checks.content_items.get(&reference.content) != Some(original) {
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
        operation: &Operation,
    ) -> Result<()> {
        for item in items {
            self.content(ports, checks, Some(operation), &item.content)?;
            self.content(ports, checks, Some(operation), &item.limitations)?;
        }
        Ok(())
    }
    fn validation(checks: &Checks) -> Validation {
        Validation {
            authority: checks.context.authority.clone(),
            content_items: checks.content_items.keys().cloned().collect(),
            fresh: checks
                .creation
                .as_ref()
                .map(|c| c.content_items.keys().cloned().collect())
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
        operation_request: OperationRequest,
        ports: &mut impl Ports,
    ) -> std::result::Result<Accepted, OperationRequestError> {
        if self.fenced {
            return Err(OperationRequestError::Fenced);
        }
        if !operation_request.profile.is_current()
            || operation_request.target != self.state.identity.change_key()
        {
            return Err(Error::Conflict.into());
        }
        let operation = operation_request.operation.clone();
        let mut checks = self.context(ports, ReadScope::Operation(operation.id.clone()))?;
        if operation_request.actor != checks.context.authority.actor
            || operation_request.represented_owner != checks.context.authority.represented_owner
        {
            return Err(Error::Denied.into());
        }
        if let Some(original) = self.records.get(&operation.id) {
            if original.operation_request()? != operation_request {
                return Err(Error::Conflict.into());
            }
            // Recover the original result, never re-execute under refreshed authority or grounds.
            // Rebinding a retained identity is still an integrity conflict, even on exact retry.
            for id in original.checks.content_items.keys() {
                self.content(ports, &mut checks, None, id)?;
            }
            ports.disclose(&checks)?;
            return Ok(original.accepted.clone());
        }
        if let Command::Propose { proposal, .. } = &operation.command {
            if proposal
                .terms
                .references()
                .iter()
                .any(|r| r.identity != self.state.identity)
            {
                return Err(Error::Invalid.into());
            }
        }
        checks.creation = self
            .state
            .prepare_creation(&operation, &checks.context.authority)?;
        let (content_items, grounds) = self.state.requirements(&operation.command)?;
        for id in content_items.into_iter().chain(
            operation
                .fresh
                .iter()
                .flat_map(|p| p.derived_from.iter().map(|r| r.content.clone())),
        ) {
            self.content(ports, &mut checks, Some(&operation), &id)?;
        }
        for id in grounds {
            checks.grounds.insert(id.clone(), ports.ground(&id)?);
        }
        if let Command::Adapt { adaptation, .. } = &operation.command {
            let judgment = ports.discretion(adaptation)?;
            if let ScopeJudgment::WithinDiscretion(evidence) = &judgment {
                self.evidence(
                    ports,
                    &mut checks,
                    std::slice::from_ref(evidence),
                    &operation,
                )?;
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
            self.evidence(ports, &mut checks, &conditions.evidence, &operation)?;
            checks.native = Some((action.clone(), conditions));
        }
        // Extra payloads would create an implicit ingestion endpoint. Only actual bindings
        // of this complete operation (including trusted judgment inputs) may be fresh.
        if operation
            .fresh
            .iter()
            .any(|p| !checks.content_items.contains_key(&p.key))
        {
            return Err(Error::Invalid.into());
        }
        let (mut candidate, effect) = self.candidate_current(&operation, &checks)?;
        ports.authorize_intake(&checks, &operation)?;
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
            profile: operation_request.profile,
            sequence: u64::try_from(self.records.len())
                .map_err(|_| Error::Invalid)?
                .checked_add(1)
                .ok_or(Error::Invalid)?,
            creations: self.state.creation_claims(&operation),
            retained_content_items: self.state.retained_bindings(&operation, &checks),
            establishments: State::establishment_claims(&operation),
            operation: operation.clone(),
            accepted: accepted.clone(),
            checks: checks.clone(),
            used_grant,
            grant_snapshot,
        };
        if record.operation_request()? != operation_request {
            return Err(Error::Invalid.into());
        }
        Self::retain(&mut candidate, &record);
        // No fallible validation or transition remains after this serialization point.
        match ports.accept(&record) {
            Acceptance::Accepted => {}
            Acceptance::Refused(error) => return Err(OperationRequestError::Refused(error)),
            Acceptance::NotAccepted(error) => {
                return Err(OperationRequestError::NotAccepted(error))
            }
            Acceptance::Indeterminate => {
                self.fenced = true;
                return Err(OperationRequestError::Indeterminate);
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
            Query::Content(id) => ReadScope::Content(id.clone()),
            Query::Operation(id) => ReadScope::Operation(id.clone()),
            Query::Status => ReadScope::Change(self.state.identity.change.clone()),
            Query::Action(id) => ReadScope::Action(id.clone()),
        };
        let mut checks = self.context(ports, scope)?;
        let content = if let Query::Content(id) = &query {
            Some(id)
        } else {
            None
        };
        if let Query::Action(id) = &query {
            self.state
                .read_action_access(&access, id, &Self::validation(&checks))?;
        } else {
            self.state
                .read_access(&access, content, &Self::validation(&checks))?;
        }
        let result = match query {
            Query::Status => Read::Status(self.state.status()),
            Query::Operation(id) => {
                if let Some(record) = self.records.get(&id) {
                    for id in record.checks.content_items.keys() {
                        self.content(ports, &mut checks, None, id)?;
                    }
                }
                Read::Operation(self.records.get(&id).map(|r| r.accepted.clone()))
            }
            Query::Content(id) => {
                if !self.state.content_items.contains_key(&id) {
                    return Err(Error::Invalid);
                }
                self.content(ports, &mut checks, None, &id)?;
                Read::Content(
                    checks
                        .content_items
                        .get(&id)
                        .ok_or(Error::Unavailable)?
                        .clone(),
                )
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
            for id in record.checks.content_items.keys() {
                self.content(ports, &mut checks, None, id)?;
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

// Current-format ordered interpretation. Consumes original snapshots, never live Ports.
impl Change {
    /// Reconstruct a complete, verified accepted prefix of the same authoritative store.
    /// Storage must supply the independently verified head/raw bytes and custody controls;
    /// this validates internal historical consistency, not authenticity against coherent forgery.
    /// Missing/unsupported/damaged records refuse the whole opening, never skip or repair.
    pub fn reconstruct(
        head: HistoryHead,
        records: impl IntoIterator<Item = StoredOperation>,
    ) -> Result<Self> {
        if !head.profile.is_current() {
            return Err(Error::Invalid);
        }
        let target = head.identity.change_key();
        let mut pursuit = Self::try_new(head.identity)?;
        for record in records {
            let sequence = u64::try_from(pursuit.records.len())
                .map_err(|_| Error::Invalid)?
                .checked_add(1)
                .ok_or(Error::Invalid)?;
            if record.profile != head.profile
                || record.operation_request()?.target != target
                || record.sequence != sequence
                || sequence > head.accepted_operations
                || pursuit.records.contains_key(&record.operation.id)
                || record.creations != pursuit.state.creation_claims(&record.operation)
                || record.establishments != State::establishment_claims(&record.operation)
                || record.retained_content_items
                    != pursuit
                        .state
                        .retained_bindings(&record.operation, &record.checks)
            {
                return Err(Error::Invalid);
            }
            pursuit.validate_current(&record.operation, &record.checks)?;
            // Reconstruction owns unpublished state. A failed transition or result comparison
            // drops the whole reconstruction, so no growing State clone is needed per record.
            let effect = pursuit
                .state
                .transition(&record.operation.command, &Self::validation(&record.checks))?;
            let expected = Accepted {
                operation: record.operation.id.clone(),
                actor: record.checks.context.authority.actor.clone(),
                represented_owner: record.checks.context.authority.represented_owner.clone(),
                effect,
            };
            let used = used_grant(&record.operation.command, &pursuit.state);
            let snapshot = used
                .as_ref()
                .and_then(|g| pursuit.state.grants.get(&g.id))
                .cloned();
            if record.accepted != expected
                || record.used_grant != used
                || record.grant_snapshot != snapshot
            {
                return Err(Error::Invalid);
            }
            Self::retain(&mut pursuit.state, &record);
            pursuit.records.insert(record.operation.id.clone(), record);
        }
        if u64::try_from(pursuit.records.len()).map_err(|_| Error::Invalid)?
            != head.accepted_operations
            || pursuit.state.last_operation != head.last_operation
        {
            return Err(Error::Invalid);
        }
        Ok(pursuit)
    }

    /// Pure shared current-format rules over declared historical/current checks. No fetching, ID allocation,
    /// publication, source authorization, effects or present-day approval. Measuring original
    /// creation usage verifies the snapshot; it does not charge a port or renew a grant.
    fn candidate_current(&self, operation: &Operation, checks: &Checks) -> Result<(State, Effect)> {
        self.validate_current(operation, checks)?;
        let mut candidate = self.state.clone();
        let effect = candidate.transition(&operation.command, &Self::validation(checks))?;
        Ok((candidate, effect))
    }

    fn validate_current(&self, operation: &Operation, checks: &Checks) -> Result<()> {
        if checks.identity != self.state.identity
            || checks.expected_operation != self.state.last_operation
            || checks.context.authority.represented_owner != self.state.identity.owner
            || checks.disclosure != ReadScope::Operation(operation.id.clone())
            || checks.disclosure_origin.is_some()
            || (!checks.context.disclosure.contains(&checks.disclosure)
                && !checks
                    .context
                    .disclosure
                    .contains(&ReadScope::Change(self.state.identity.change.clone())))
            || self.records.contains_key(&operation.id)
        {
            return Err(Error::Invalid);
        }
        if checks.creation
            != self
                .state
                .prepare_creation(operation, &checks.context.authority)?
        {
            return Err(Error::Invalid);
        }
        let (mut content_items, grounds) = self.state.requirements(&operation.command)?;
        match (&operation.command, &checks.adaptation) {
            (Command::Adapt { adaptation, .. }, Some((original, judgment)))
                if adaptation == original =>
            {
                if let ScopeJudgment::WithinDiscretion(evidence) = judgment {
                    evidence_ids(std::slice::from_ref(evidence), &mut content_items);
                }
                // Keep the live rule's NeedsRevision/Unavailable refusals. An accepted
                // historical record with either judgment still fails that same transition.
            }
            (Command::Adapt { .. }, _) => return Err(Error::Invalid),
            (_, None) => {}
            _ => return Err(Error::Invalid),
        }
        let request = match &operation.command {
            Command::Admit(a) => Some(a),
            Command::Dispatch { action } => Some(self.state.action_request(action)?),
            _ => None,
        };
        match (request, &checks.native) {
            (Some(request), Some((original, conditions)))
                if request == original && conditions.action == request.id =>
            {
                evidence_ids(&conditions.evidence, &mut content_items);
            }
            (None, None) => {}
            _ => return Err(Error::Invalid),
        }
        for payload in &operation.fresh {
            content_items.extend(payload.derived_from.iter().map(|r| r.content.clone()));
        }
        if checks
            .content_items
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>()
            != content_items
            || checks.grounds.keys().cloned().collect::<BTreeSet<_>>() != grounds
            || checks.intakes.keys().cloned().collect::<BTreeSet<_>>() != content_items
            || !operation.first_retention.is_subset(&content_items)
            || operation
                .first_retention
                .iter()
                .any(|k| operation.fresh.iter().any(|p| &p.key == k))
            || operation
                .fresh
                .iter()
                .any(|p| !content_items.contains(&p.key))
        {
            return Err(Error::Invalid);
        }
        for (key, bytes) in &checks.content_items {
            let snapshot = checks.intakes.get(key).ok_or(Error::Invalid)?;
            let expected_case = if operation.fresh.iter().any(|p| &p.key == key) {
                IntakeCase::Fresh
            } else if operation.first_retention.contains(key) {
                IntakeCase::FirstRetention
            } else {
                IntakeCase::KnownReuse
            };
            if snapshot.case != expected_case {
                return Err(Error::Invalid);
            }
            self.check_intake(Some(operation), key, bytes, snapshot)?;
        }
        self.derivation_references(operation, checks)?;
        self.proposal_references(operation, checks)?;
        Ok(())
    }

    fn retain(state: &mut State, record: &StoredOperation) {
        for key in &record.establishments {
            state.established.insert(
                key.clone(),
                ContentEstablishment {
                    binding: ContentReference {
                        identity: record.checks.identity.clone(),
                        operation: record.operation.id.clone(),
                        content: key.clone(),
                    },
                    original: record.checks.intakes[key].clone(),
                    recorder: record.accepted.actor.clone(),
                    represented_owner: record.accepted.represented_owner.clone(),
                    grant: record.used_grant.clone(),
                    target: record
                        .grant_snapshot
                        .as_ref()
                        .map(|g| g.spec.target.clone()),
                },
            );
        }
        state
            .content_items
            .extend(record.checks.content_items.clone());
        if let Some(creation) = &record.checks.creation {
            state.created.extend(creation.content_items.clone());
        }
        state.history.insert(
            record.operation.id.clone(),
            (record.operation.clone(), record.accepted.clone()),
        );
        state.last_operation = Some(record.operation.id.clone());
    }
}
fn evidence_ids(items: &[Evidence], out: &mut BTreeSet<ContentKey>) {
    for item in items {
        out.extend([item.content.clone(), item.limitations.clone()]);
    }
}
