//! Current-format ordered interpretation. Consumes original snapshots, never live Ports.
use super::*;
use std::collections::BTreeSet;

impl Pursuit {
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
        let mut pursuit = Self::new(head.identity)?;
        for record in records {
            let sequence = u64::try_from(pursuit.records.len())
                .map_err(|_| Error::Invalid)?
                .checked_add(1)
                .ok_or(Error::Invalid)?;
            if record.profile != head.profile
                || record.submission()?.target != target
                || record.sequence != sequence
                || sequence > head.accepted_operations
                || pursuit.records.contains_key(&record.operation.id)
                || record.creations != pursuit.state.creation_claims(&record.operation)
                || record.retained_materials
                    != pursuit
                        .state
                        .retained_bindings(&record.operation, &record.checks)
            {
                return Err(Error::Invalid);
            }
            let (mut candidate, effect) =
                pursuit.candidate_current(&record.operation, &record.checks)?;
            let expected = Accepted {
                operation: record.operation.id.clone(),
                actor: record.checks.context.authority.actor.clone(),
                represented_owner: record.checks.context.authority.represented_owner.clone(),
                effect,
            };
            let used = used_grant(&record.operation.command, &candidate);
            let snapshot = used
                .as_ref()
                .and_then(|g| candidate.grants.get(&g.id))
                .cloned();
            if record.accepted != expected
                || record.used_grant != used
                || record.grant_snapshot != snapshot
            {
                return Err(Error::Invalid);
            }
            Self::retain(&mut candidate, &record);
            pursuit.state = candidate;
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
    pub(super) fn candidate_current(
        &self,
        operation: &Operation,
        checks: &Checks,
    ) -> Result<(State, Effect)> {
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
        let (mut materials, grounds) = self.state.requirements(&operation.command)?;
        match (&operation.command, &checks.adaptation) {
            (Command::Adapt { adaptation, .. }, Some((original, judgment)))
                if adaptation == original =>
            {
                if let ScopeJudgment::WithinDiscretion(evidence) = judgment {
                    evidence_ids(std::slice::from_ref(evidence), &mut materials);
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
                evidence_ids(&conditions.evidence, &mut materials);
            }
            (None, None) => {}
            _ => return Err(Error::Invalid),
        }
        if checks.materials.keys().cloned().collect::<BTreeSet<_>>() != materials
            || checks.grounds.keys().cloned().collect::<BTreeSet<_>>() != grounds
            || operation.fresh.iter().any(|p| !materials.contains(&p.id))
        {
            return Err(Error::Invalid);
        }
        for (id, bytes) in &checks.materials {
            if self.state.materials.get(id).is_some_and(|old| old != bytes)
                || checks
                    .creation
                    .as_ref()
                    .and_then(|c| c.materials.get(id))
                    .is_some_and(|created| &created.payload.bytes != bytes)
            {
                return Err(Error::Conflict);
            }
        }
        self.proposal_references(operation, checks)?;
        let mut candidate = self.state.clone();
        let effect = candidate.transition(&operation.command, &Self::validation(checks))?;
        Ok((candidate, effect))
    }

    pub(super) fn retain(state: &mut State, record: &StoredOperation) {
        state.materials.extend(record.checks.materials.clone());
        if let Some(creation) = &record.checks.creation {
            state.created.extend(creation.materials.clone());
        }
        state.history.insert(
            record.operation.id.clone(),
            (record.operation.clone(), record.accepted.clone()),
        );
        state.last_operation = Some(record.operation.id.clone());
    }
}
fn evidence_ids(items: &[Evidence], out: &mut BTreeSet<MaterialId>) {
    for item in items {
        out.extend([item.material.clone(), item.limitations.clone()]);
    }
}
