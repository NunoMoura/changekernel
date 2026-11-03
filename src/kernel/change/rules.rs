use super::content::OriginSelector;
use super::model::{
    Access, Action, ActionId, ActionOutcome, ActionPhase, ActionRequest, Agreement, AgreementId,
    Assessment, AssessmentId, Authority, ChangeBasis, Command, ContentKey, ContentReference,
    Decision, DecisionId, DecisionKind, Dependency, Effect, EffectiveDecision, Error, Evidence,
    Grant, GrantAction, GrantSpec, GrantTarget, GrantUse, GroundId, GroundVersion, Proposal,
    ProposalId, Result, ScopeJudgment, Settlement, State, Terms, Validation,
};
use std::collections::{BTreeMap, BTreeSet};

fn nonempty<T>(items: &[T]) -> Result<()> {
    if items.is_empty() {
        Err(Error::Invalid)
    } else {
        Ok(())
    }
}
fn evidence_content_items(evidence: &[Evidence], out: &mut BTreeSet<ContentKey>) {
    for e in evidence {
        out.extend([e.content.clone(), e.limitations.clone()]);
    }
}
impl Terms {
    pub(crate) fn references(&self) -> BTreeSet<ContentReference> {
        self.binding
            .iter()
            .flat_map(|t| std::iter::once(t.statement.clone()).chain(t.context.iter().cloned()))
            .chain(self.context.iter().cloned())
            .chain(
                self.criteria.iter().flat_map(|c| {
                    std::iter::once(c.definition.clone()).chain(c.terms.iter().cloned())
                }),
            )
            .chain(
                self.unknowns
                    .iter()
                    .flat_map(|u| u.affected.iter().cloned()),
            )
            .collect()
    }

    fn validate_roles(&self) -> Result<()> {
        let selected: BTreeSet<_> = self.binding.iter().map(|t| t.statement.clone()).collect();
        if selected.len() != self.binding.len()
            || self
                .binding
                .iter()
                .any(|t| !t.context.is_subset(&self.context))
            || self
                .criteria
                .iter()
                .any(|c| c.terms.is_empty() || !c.terms.is_subset(&selected))
        {
            return Err(Error::Invalid);
        }
        // Compare content identity, not operation references or byte equality. Another
        // accepted binding of the same content cannot bypass binding/context separation.
        let binding: BTreeSet<_> = selected
            .iter()
            .map(|r| &r.content)
            .chain(self.criteria.iter().map(|c| &c.definition.content))
            .collect();
        if self.context.iter().any(|r| binding.contains(&r.content)) {
            return Err(Error::Conflict);
        }
        Ok(())
    }
}
fn terms_content_items(terms: &Terms, out: &mut BTreeSet<ContentKey>) {
    out.extend(terms.references().into_iter().map(|r| r.content));
    for u in &terms.unknowns {
        out.extend([u.question.clone(), u.bounded_by.clone()]);
    }
}
fn assessment_content_items(a: &Assessment, out: &mut BTreeSet<ContentKey>) {
    out.extend([
        a.feasibility.clone(),
        a.capabilities.clone(),
        a.resources.clone(),
        a.commitments.clone(),
        a.coverage.clone(),
        a.limitations.clone(),
    ]);
    out.extend(a.blockers.iter().cloned());
}
fn dependencies_valid(
    deps: &[Dependency],
    current: &BTreeMap<GroundId, GroundVersion>,
) -> Result<()> {
    let mut seen = BTreeMap::new();
    for d in deps {
        if seen.insert(&d.ground, &d.version).is_some() {
            return Err(Error::Invalid);
        }
        if current.get(&d.ground) != Some(&d.version) {
            return Err(Error::Stale);
        }
    }
    Ok(())
}
fn merged(deps: impl IntoIterator<Item = Dependency>) -> Result<Vec<Dependency>> {
    let mut map = BTreeMap::new();
    for d in deps {
        if map
            .insert(d.ground, d.version.clone())
            .is_some_and(|v| v != d.version)
        {
            return Err(Error::Stale);
        }
    }
    Ok(map
        .into_iter()
        .map(|(ground, version)| Dependency { ground, version })
        .collect())
}
impl State {
    fn proposal(&self, id: &ProposalId) -> Result<&Proposal> {
        self.proposals.get(id).ok_or(Error::Invalid)
    }
    fn assessment(&self, id: &AssessmentId) -> Result<&Assessment> {
        self.assessments.get(id).ok_or(Error::Invalid)
    }
    fn decision(&self, id: &DecisionId) -> Result<&EffectiveDecision> {
        self.decisions.get(id).ok_or(Error::Invalid)
    }
    fn agreement(&self, id: &AgreementId) -> Result<&Agreement> {
        self.agreements.get(id).ok_or(Error::Invalid)
    }
    fn current_agreement(&self, id: &AgreementId) -> Result<&Agreement> {
        if self.settlement.is_some() {
            return Err(Error::Terminal);
        }
        if self.current.as_ref() != Some(id) {
            return Err(Error::Stale);
        }
        self.agreement(id)
    }
    fn owner(&self, a: &Authority) -> Result<()> {
        if a.actor != self.identity.owner_actor
            || a.represented_owner != self.identity.owner
            || a.owner_control.as_ref() != Some(&self.identity)
        {
            return Err(Error::Denied);
        }
        Ok(())
    }
    fn agent(&self, a: &Authority) -> Result<()> {
        if a.actor != self.identity.agent
            || a.represented_owner != self.identity.owner
            || a.agent_role.as_ref() != Some(&self.identity)
        {
            return Err(Error::Denied);
        }
        Ok(())
    }
    fn party(&self, kind: &DecisionKind, a: &Authority) -> Result<()> {
        match kind {
            DecisionKind::Adopt => self.owner(a),
            DecisionKind::Undertake { .. } => self.agent(a),
        }
    }
    pub(super) fn grant(&self, used: &GrantUse, authority: &Authority) -> Result<&Grant> {
        let g = self.grants.get(&used.id).ok_or(Error::Denied)?;
        if g.revoked
            || g.generation != used.generation
            || g.spec.recipient != authority.actor
            || authority.represented_owner != self.identity.owner
        {
            return Err(Error::Denied);
        }
        Ok(g)
    }
    fn decision_dependencies(&self, d: &Decision) -> Result<Vec<Dependency>> {
        let p = self.proposal(&d.proposal)?;
        let mut deps: BTreeMap<_, _> = p
            .dependencies
            .iter()
            .map(|d| (d.ground.clone(), d.version.clone()))
            .collect();
        if let DecisionKind::Undertake { assessment } = &d.kind {
            let a = self.assessment(assessment)?;
            if a.proposal != p.id {
                return Err(Error::Conflict);
            }
            for dep in &a.dependencies {
                deps.insert(dep.ground.clone(), dep.version.clone());
            }
            if d.dependencies.iter().any(|dep| {
                a.dependencies
                    .iter()
                    .any(|a| a.ground == dep.ground && a.version != dep.version)
            }) {
                return Err(Error::Stale);
            }
        }
        let mut seen = BTreeSet::new();
        for dep in &d.dependencies {
            if !seen.insert(dep.ground.clone()) {
                return Err(Error::Invalid);
            }
            deps.insert(dep.ground.clone(), dep.version.clone());
        }
        Ok(deps
            .into_iter()
            .map(|(ground, version)| Dependency { ground, version })
            .collect())
    }

    fn agreement_dependencies(&self, id: &AgreementId) -> Result<Vec<Dependency>> {
        let a = self.agreement(id)?;
        merged(
            [
                self.decision_dependencies(&self.decision(&a.adoption)?.decision)?,
                self.decision_dependencies(&self.decision(&a.undertaking)?.decision)?,
            ]
            .concat(),
        )
    }
    fn current_grounds(&self, id: &AgreementId, v: &Validation) -> Result<()> {
        self.current_agreement(id)?;
        dependencies_valid(&self.agreement_dependencies(id)?, &v.grounds)
    }
    fn proposal_requirements(
        &self,
        id: &ProposalId,
        content_items: &mut BTreeSet<ContentKey>,
        grounds: &mut BTreeSet<GroundId>,
    ) -> Result<()> {
        let p = self.proposal(id)?;
        terms_content_items(&p.terms, content_items);
        grounds.extend(p.dependencies.iter().map(|d| d.ground.clone()));
        Ok(())
    }
    fn decision_requirements(
        &self,
        d: &Decision,
        content_items: &mut BTreeSet<ContentKey>,
        grounds: &mut BTreeSet<GroundId>,
    ) -> Result<()> {
        self.proposal_requirements(&d.proposal, content_items, grounds)?;
        grounds.extend(d.dependencies.iter().map(|d| d.ground.clone()));
        if let DecisionKind::Undertake { assessment } = &d.kind {
            let a = self.assessment(assessment)?;
            assessment_content_items(a, content_items);
            grounds.extend(a.dependencies.iter().map(|d| d.ground.clone()));
        }
        Ok(())
    }
    fn agreement_requirements(
        &self,
        id: &AgreementId,
        content_items: &mut BTreeSet<ContentKey>,
        grounds: &mut BTreeSet<GroundId>,
    ) -> Result<()> {
        let a = self.agreement(id)?;
        content_items.extend(a.blockers.iter().cloned());
        self.decision_requirements(
            &self.decision(&a.adoption)?.decision,
            content_items,
            grounds,
        )?;
        self.decision_requirements(
            &self.decision(&a.undertaking)?.decision,
            content_items,
            grounds,
        )
    }
    pub(crate) fn action_request(&self, id: &ActionId) -> Result<&ActionRequest> {
        Ok(&self.actions.get(id).ok_or(Error::Invalid)?.request)
    }
    pub(crate) fn requirements(
        &self,
        command: &Command,
    ) -> Result<(BTreeSet<ContentKey>, BTreeSet<GroundId>)> {
        let (mut m, mut g) = (BTreeSet::new(), BTreeSet::new());
        match command {
            Command::Initiate { wish, .. } => {
                m.insert(wish.clone());
            }
            Command::Propose { proposal: p, .. } => {
                terms_content_items(&p.terms, &mut m);
                g.extend(p.dependencies.iter().map(|d| d.ground.clone()));
            }
            Command::Assess { assessment: a, .. } => {
                self.proposal_requirements(&a.proposal, &mut m, &mut g)?;
                assessment_content_items(a, &mut m);
                g.extend(a.dependencies.iter().map(|d| d.ground.clone()));
            }
            Command::Decide(d) => {
                self.decision_requirements(d, &mut m, &mut g)?;
                for old in self
                    .decisions
                    .values()
                    .filter(|old| !old.retracted && old.decision.proposal == d.proposal)
                {
                    self.decision_requirements(&old.decision, &mut m, &mut g)?;
                }
            }
            Command::Retract { .. } | Command::RevokeGrant { .. } => {}
            Command::Reaffirm {
                decision,
                dependencies,
                assessment,
            } => {
                let d = &self.decision(decision)?.decision;
                self.decision_requirements(d, &mut m, &mut g)?;
                for old in self
                    .decisions
                    .values()
                    .filter(|old| !old.retracted && old.decision.proposal == d.proposal)
                {
                    self.decision_requirements(&old.decision, &mut m, &mut g)?;
                }
                if let Some(id) = assessment {
                    let a = self.assessment(id)?;
                    assessment_content_items(a, &mut m);
                    g.extend(a.dependencies.iter().map(|d| d.ground.clone()));
                }
                g.extend(dependencies.iter().map(|d| d.ground.clone()));
            }
            Command::SetGrant { spec, .. } => {
                m.extend(spec.content_items.iter().cloned());
                m.extend(spec.disclosure.iter().cloned());
                self.validate_origin_selectors(spec)?;
                for selector in spec.content_origins.iter().chain(&spec.disclosure_origins) {
                    if let OriginSelector::Historical(origin) = selector {
                        m.insert(origin.binding.content.clone());
                    }
                }
            }
            Command::Admit(a) => {
                self.agreement_requirements(&a.agreement, &mut m, &mut g)?;
                m.extend(a.conditions.iter().cloned());
                g.extend(a.dependencies.iter().map(|d| d.ground.clone()));
            }
            Command::Dispatch { action } => {
                let a = self.actions.get(action).ok_or(Error::Invalid)?;
                self.agreement_requirements(&a.request.agreement, &mut m, &mut g)?;
                m.extend(a.request.conditions.iter().cloned());
                g.extend(
                    a.request
                        .dependencies
                        .iter()
                        .chain(&a.admission_dependencies)
                        .map(|d| d.ground.clone()),
                );
            }
            Command::Finding { finding: f, .. } => {
                if let Some(a) = &f.agreement {
                    self.agreement_requirements(a, &mut m, &mut g)?;
                }
                m.insert(f.claim.clone());
                evidence_content_items(&f.evidence, &mut m);
            }
            Command::Adapt { adaptation: a, .. } => {
                self.agreement_requirements(&a.agreement, &mut m, &mut g)?;
                m.extend([a.previous_approach.clone(), a.changed_approach.clone()]);
                evidence_content_items(&a.grounds, &mut m);
            }
            Command::Progress { progress: p, .. } => {
                // The validated term subset adds no content: retain and revalidate the
                // complete agreement, not just the statements selected for progress.
                self.agreement_requirements(&p.agreement, &mut m, &mut g)?;
                m.extend([
                    p.understanding.assessment.clone(),
                    p.outcome.assessment.clone(),
                ]);
                evidence_content_items(&p.evidence, &mut m);
            }
            Command::Fulfill(f) => {
                self.agreement_requirements(&f.agreement, &mut m, &mut g)?;
                m.insert(f.acceptance.clone());
                for c in &f.criteria {
                    evidence_content_items(&c.evidence, &mut m);
                }
                for r in &f.resolutions {
                    m.insert(r.blocker.clone());
                    evidence_content_items(&r.evidence, &mut m);
                }
            }
            Command::Withdraw { reason } => {
                m.insert(reason.clone());
            }
            Command::Reconcile { evidence, .. } => {
                evidence_content_items(evidence, &mut m);
            }
        }
        Ok((m, g))
    }
    fn record_access(
        &self,
        access: &Access,
        action: GrantAction,
        agreement: Option<&AgreementId>,
        v: &Validation,
    ) -> Result<()> {
        match access {
            Access::Owner => self.owner(&v.authority),
            Access::Grant(used) => {
                let g = self.grant(used, &v.authority)?;
                if !g.spec.actions.contains(&action) || !self.covers_content_items(g, v) {
                    return Err(Error::Denied);
                }
                match (&g.spec.target, agreement, action) {
                    (GrantTarget::DraftCreation(change), None, GrantAction::CreateDraft)
                        if *change == self.identity.change && !self.initiated =>
                    {
                        Ok(())
                    }
                    (GrantTarget::Draft(change), None, _) if *change == self.identity.change => {
                        Ok(())
                    }
                    (GrantTarget::Pursuit(target), Some(current), _) if target == current => Ok(()),
                    _ => Err(Error::Denied),
                }
            }
        }
    }
    fn activate(&mut self, proposal: &ProposalId, v: &Validation) -> Result<Option<AgreementId>> {
        let p = self.proposal(proposal)?.clone();
        if self.current.as_ref() == Some(&p.agreement) {
            let undertaking = self.agreement(&p.agreement)?.undertaking.clone();
            let blockers = self.decision(&undertaking)?.blockers.clone();
            self.agreements
                .get_mut(&p.agreement)
                .ok_or(Error::Invalid)?
                .blockers
                .extend(blockers);
            return Ok(None);
        }
        if p.expected_agreement != self.current || self.settlement.is_some() {
            return Err(Error::Stale);
        }
        let mut adopt = None;
        let mut undertake = None;
        for (id, d) in &self.decisions {
            if d.retracted || d.decision.proposal != *proposal {
                continue;
            }
            if dependencies_valid(&self.decision_dependencies(&d.decision)?, &v.grounds).is_err() {
                continue;
            }
            match d.decision.kind {
                DecisionKind::Adopt => adopt = Some(id.clone()),
                DecisionKind::Undertake { .. } => undertake = Some(id.clone()),
            }
        }
        if let (Some(adoption), Some(undertaking)) = (adopt, undertake) {
            let mut blockers = self.decision(&undertaking)?.blockers.clone();
            if let Some(current) = &self.current {
                blockers.extend(self.agreement(current)?.blockers.iter().cloned());
            }
            self.decisions
                .get_mut(&adoption)
                .ok_or(Error::Invalid)?
                .matched = true;
            self.decisions
                .get_mut(&undertaking)
                .ok_or(Error::Invalid)?
                .matched = true;
            self.agreements.insert(
                p.agreement.clone(),
                Agreement {
                    proposal: p.id,
                    adoption,
                    undertaking,
                    blockers,
                },
            );
            self.current = Some(p.agreement.clone());
            return Ok(Some(p.agreement));
        }
        Ok(None)
    }
    fn native_grant(&self, a: &ActionRequest, kind: GrantAction, v: &Validation) -> Result<()> {
        let g = self.grant(&a.grant, &v.authority)?;
        if g.spec.target != GrantTarget::Pursuit(a.agreement.clone())
            || !g.spec.actions.contains(&kind)
            || !g.spec.native_actions.contains(&a.native_action)
            || a.scope.is_empty()
            || !a.scope.is_subset(&g.spec.native_scope)
            || a.limits.is_empty()
            || a.limits != g.spec.limits
        {
            return Err(Error::Denied);
        }
        nonempty(&a.conditions)?;
        let native = v.native.as_ref().ok_or(Error::Unavailable)?;
        if native.action != a.id || native.evidence.is_empty() {
            return Err(Error::Unavailable);
        }
        self.current_grounds(&a.agreement, v)?;
        dependencies_valid(&a.dependencies, &v.grounds)
    }
    pub(crate) fn read_access(
        &self,
        access: &Access,
        content: Option<&ContentKey>,
        v: &Validation,
    ) -> Result<()> {
        match access {
            Access::Owner => self.owner(&v.authority),
            Access::Grant(used) => {
                let g = self.grant(used, &v.authority)?;
                if self.settlement.is_some()
                    && !matches!(g.spec.target, GrantTarget::Reconciliation(_))
                {
                    return Err(Error::Terminal);
                }
                if content.is_none_or(|id| !self.discloses_content(g, id)) {
                    return Err(Error::Denied);
                }
                Ok(())
            }
        }
    }
    pub(crate) fn read_action_access(
        &self,
        access: &Access,
        action: &ActionId,
        v: &Validation,
    ) -> Result<()> {
        match access {
            Access::Owner => self.owner(&v.authority),
            Access::Grant(used) => {
                let grant = self.grant(used, &v.authority)?;
                if !matches!(&grant.spec.target, GrantTarget::Reconciliation(ids) if ids.contains(action))
                {
                    return Err(Error::Denied);
                }
                Ok(())
            }
        }
    }
    pub(crate) fn transition(&mut self, command: &Command, v: &Validation) -> Result<Effect> {
        if v.authority.represented_owner != self.identity.owner {
            return Err(Error::Denied);
        }
        if self.settlement.is_some()
            && !matches!(
                command,
                Command::Reconcile { .. }
                    | Command::SetGrant {
                        spec: GrantSpec {
                            target: GrantTarget::Reconciliation(_),
                            ..
                        },
                        ..
                    }
                    | Command::RevokeGrant { .. }
            )
        {
            return Err(Error::Terminal);
        }
        if !self.initiated
            && !matches!(
                command,
                Command::Initiate { .. } | Command::SetGrant { .. } | Command::RevokeGrant { .. }
            )
        {
            return Err(Error::Invalid);
        }
        match command {
            Command::Initiate { wish: _, access } => {
                if self.initiated {
                    return Err(Error::Conflict);
                }
                self.record_access(access, GrantAction::CreateDraft, None, v)?;
                self.initiated = true;
                Ok(Effect::Initiated)
            }
            Command::Propose {
                proposal: p,
                access,
            } => {
                self.record_access(access, GrantAction::Propose, None, v)?;
                if p.identity != self.identity || p.expected_agreement != self.current {
                    return Err(Error::Stale);
                }
                if self.proposals.contains_key(&p.id)
                    || self
                        .proposals
                        .values()
                        .any(|old| old.agreement == p.agreement)
                {
                    return Err(Error::Conflict);
                }
                p.terms.validate_roles()?;
                let mut criteria = BTreeSet::new();
                for c in &p.terms.criteria {
                    if !criteria.insert(c.id.clone())
                        || self
                            .proposals
                            .values()
                            .flat_map(|p| &p.terms.criteria)
                            .any(|old| old.id == c.id && old != c)
                    {
                        return Err(Error::Conflict);
                    }
                }
                dependencies_valid(&p.dependencies, &v.grounds)?;
                self.proposals.insert(p.id.clone(), p.clone());
                Ok(Effect::Proposed(p.id.clone()))
            }
            Command::Assess {
                assessment: a,
                access,
            } => {
                self.record_access(access, GrantAction::Assess, None, v)?;
                self.proposal(&a.proposal)?;
                if self.assessments.contains_key(&a.id) {
                    return Err(Error::Conflict);
                }
                dependencies_valid(&a.dependencies, &v.grounds)?;
                self.assessments.insert(a.id.clone(), a.clone());
                Ok(Effect::Assessed(a.id.clone()))
            }
            Command::Decide(d) => {
                self.party(&d.kind, &v.authority)?;
                let p = self.proposal(&d.proposal)?;
                nonempty(&p.terms.binding)?;
                if p.expected_agreement != self.current {
                    return Err(Error::Stale);
                }
                if self.decisions.contains_key(&d.id)
                    || self.decisions.values().any(|old| {
                        !old.retracted
                            && old.decision.proposal == d.proposal
                            && std::mem::discriminant(&old.decision.kind)
                                == std::mem::discriminant(&d.kind)
                    })
                {
                    return Err(Error::Conflict);
                }
                dependencies_valid(&d.dependencies, &v.grounds)?;
                dependencies_valid(&self.decision_dependencies(d)?, &v.grounds)?;
                let blockers = match &d.kind {
                    DecisionKind::Adopt => BTreeSet::new(),
                    DecisionKind::Undertake { assessment } => self
                        .assessment(assessment)?
                        .blockers
                        .iter()
                        .cloned()
                        .collect(),
                };
                self.decisions.insert(
                    d.id.clone(),
                    EffectiveDecision {
                        decision: d.clone(),
                        actor: v.authority.actor.clone(),
                        retracted: false,
                        matched: false,
                        blockers,
                    },
                );
                let activated = self.activate(&d.proposal, v)?;
                Ok(Effect::Decision {
                    decision: d.id.clone(),
                    activated,
                })
            }
            Command::Retract { decision } => {
                let d = self.decision(decision)?;
                self.party(&d.decision.kind, &v.authority)?;
                if d.actor != v.authority.actor || d.retracted || d.matched {
                    return Err(Error::Conflict);
                }
                self.decisions
                    .get_mut(decision)
                    .ok_or(Error::Invalid)?
                    .retracted = true;
                Ok(Effect::Retracted(decision.clone()))
            }
            Command::Reaffirm {
                decision,
                dependencies,
                assessment,
            } => {
                let old = self.decision(decision)?.clone();
                self.party(&old.decision.kind, &v.authority)?;
                if old.actor != v.authority.actor || old.retracted {
                    return Err(Error::Denied);
                }
                let p = self.proposal(&old.decision.proposal)?;
                if self.current.as_ref() != Some(&p.agreement)
                    && p.expected_agreement != self.current
                {
                    return Err(Error::Stale);
                }
                let mut renewed = old.decision.clone();
                renewed.dependencies = dependencies.clone();
                match (&old.decision.kind, assessment) {
                    (DecisionKind::Adopt, None) => {}
                    (DecisionKind::Undertake { .. }, Some(id)) => {
                        renewed.kind = DecisionKind::Undertake {
                            assessment: id.clone(),
                        }
                    }
                    _ => return Err(Error::Invalid),
                }
                let previous = self.decision_dependencies(&old.decision)?;
                let next = self.decision_dependencies(&renewed)?;
                if previous
                    .iter()
                    .any(|d| !next.iter().any(|n| n.ground == d.ground))
                {
                    return Err(Error::Invalid);
                }
                dependencies_valid(&next, &v.grounds)?;
                let blockers = match &renewed.kind {
                    DecisionKind::Adopt => BTreeSet::new(),
                    DecisionKind::Undertake { assessment } => self
                        .assessment(assessment)?
                        .blockers
                        .iter()
                        .cloned()
                        .collect(),
                };
                let effective = self.decisions.get_mut(decision).ok_or(Error::Invalid)?;
                effective.blockers.extend(blockers);
                effective.decision = renewed;
                let activated = self.activate(&old.decision.proposal, v)?;
                Ok(Effect::Reaffirmed {
                    decision: decision.clone(),
                    activated,
                })
            }
            Command::SetGrant {
                id,
                expected_generation,
                spec,
            } => {
                self.owner(&v.authority)?;
                self.validate_origin_selectors(spec)?;
                if spec.actions.is_empty()
                    && spec.disclosure.is_empty()
                    && spec.disclosure_origins.is_empty()
                {
                    return Err(Error::Invalid);
                }
                if spec.actions.is_empty()
                    && (!spec.native_actions.is_empty() || !spec.native_scope.is_empty())
                {
                    return Err(Error::Invalid);
                }
                match &spec.target {
                    GrantTarget::DraftCreation(change)
                        if *change == self.identity.change
                            && !self.initiated
                            && spec.actions == BTreeSet::from([GrantAction::CreateDraft])
                            && spec.native_actions.is_empty()
                            && spec.native_scope.is_empty() => {}
                    GrantTarget::Draft(change)
                        if *change == self.identity.change
                            && spec.actions.iter().all(|a| {
                                matches!(
                                    a,
                                    GrantAction::Propose
                                        | GrantAction::Assess
                                        | GrantAction::Finding
                                )
                            })
                            && spec.native_actions.is_empty()
                            && spec.native_scope.is_empty() => {}
                    GrantTarget::Pursuit(a)
                        if self.current.as_ref() == Some(a) && self.settlement.is_none() => {}
                    GrantTarget::Reconciliation(actions)
                        if !actions.is_empty()
                            && actions.iter().all(|id| self.actions.contains_key(id))
                            && spec
                                .actions
                                .is_subset(&BTreeSet::from([GrantAction::Reconcile]))
                            && spec.native_actions.is_empty()
                            && spec.native_scope.is_empty() => {}
                    _ => return Err(Error::Denied),
                }
                let generation = match self.grants.get(id) {
                    None if expected_generation.is_none() => 1,
                    Some(old) if !old.revoked && *expected_generation == Some(old.generation) => {
                        old.generation.checked_add(1).ok_or(Error::Invalid)?
                    }
                    _ => return Err(Error::Conflict),
                };
                self.grants.insert(
                    id.clone(),
                    Grant {
                        id: id.clone(),
                        generation,
                        spec: spec.clone(),
                        revoked: false,
                    },
                );
                Ok(Effect::Grant(GrantUse {
                    id: id.clone(),
                    generation,
                }))
            }
            Command::RevokeGrant {
                id,
                expected_generation,
            } => {
                self.owner(&v.authority)?;
                let old = self.grants.get_mut(id).ok_or(Error::Conflict)?;
                if old.revoked || old.generation != *expected_generation {
                    return Err(Error::Conflict);
                }
                old.generation = old.generation.checked_add(1).ok_or(Error::Invalid)?;
                old.revoked = true;
                Ok(Effect::Revoked(GrantUse {
                    id: id.clone(),
                    generation: old.generation,
                }))
            }
            Command::Admit(a) => {
                if self.actions.contains_key(&a.id) {
                    return Err(Error::Conflict);
                }
                self.native_grant(a, GrantAction::Admit, v)?;
                let admission_dependencies = self.agreement_dependencies(&a.agreement)?;
                self.actions.insert(
                    a.id.clone(),
                    Action {
                        request: a.clone(),
                        actor: v.authority.actor.clone(),
                        phase: ActionPhase::Admitted,
                        admission_dependencies,
                        evidence: vec![],
                        outcome: ActionOutcome::Unknown,
                    },
                );
                Ok(Effect::Admitted(a.id.clone()))
            }
            Command::Dispatch { action } => {
                let a = self.actions.get(action).ok_or(Error::Invalid)?.clone();
                if a.phase != ActionPhase::Admitted || a.actor != v.authority.actor {
                    return Err(Error::Conflict);
                }
                self.native_grant(&a.request, GrantAction::Dispatch, v)?;
                dependencies_valid(&a.admission_dependencies, &v.grounds)?;
                self.actions.get_mut(action).ok_or(Error::Invalid)?.phase = ActionPhase::Dispatched;
                Ok(Effect::Dispatched(action.clone()))
            }
            Command::Finding { finding: f, access } => {
                if let Some(a) = &f.agreement {
                    self.current_grounds(a, v)?;
                }
                self.record_access(access, GrantAction::Finding, f.agreement.as_ref(), v)?;
                nonempty(&f.evidence)?;
                Ok(Effect::Recorded)
            }
            Command::Adapt {
                adaptation: a,
                access,
            } => {
                self.current_grounds(&a.agreement, v)?;
                self.record_access(access, GrantAction::Adapt, Some(&a.agreement), v)?;
                nonempty(&a.grounds)?;
                match v.scope.as_ref().ok_or(Error::Unavailable)? {
                    ScopeJudgment::WithinDiscretion(_) => {}
                    ScopeJudgment::RequiresRevision => return Err(Error::NeedsRevision),
                    ScopeJudgment::Unavailable => return Err(Error::Unavailable),
                }
                Ok(Effect::Recorded)
            }
            Command::Progress {
                progress: p,
                access,
            } => {
                self.current_grounds(&p.agreement, v)?;
                self.record_access(access, GrantAction::Progress, Some(&p.agreement), v)?;
                nonempty(&p.evidence)?;
                let a = self.agreement(&p.agreement)?;
                let proposal = self.proposal(&a.proposal)?;
                let terms: BTreeSet<_> = proposal
                    .terms
                    .binding
                    .iter()
                    .map(|t| t.statement.clone())
                    .collect();
                let criteria: BTreeSet<_> = proposal
                    .terms
                    .criteria
                    .iter()
                    .map(|c| c.id.clone())
                    .collect();
                if p.terms.is_empty()
                    || !p.terms.is_subset(&terms)
                    || !p.criteria.is_subset(&criteria)
                {
                    return Err(Error::Invalid);
                }
                if p.basis == ChangeBasis::RevisedTargets && proposal.expected_agreement.is_none() {
                    return Err(Error::Invalid);
                }
                Ok(Effect::Recorded)
            }
            Command::Fulfill(f) => {
                self.owner(&v.authority)?;
                self.current_grounds(&f.agreement, v)?;
                let a = self.agreement(&f.agreement)?;
                let criteria: BTreeSet<_> = self
                    .proposal(&a.proposal)?
                    .terms
                    .criteria
                    .iter()
                    .map(|c| c.id.clone())
                    .collect();
                let provided: BTreeSet<_> =
                    f.criteria.iter().map(|c| c.criterion.clone()).collect();
                if criteria.is_empty()
                    || criteria != provided
                    || provided.len() != f.criteria.len()
                    || f.criteria.iter().any(|c| c.evidence.is_empty())
                {
                    return Err(Error::Invalid);
                }
                // Endorsed blockers survive omission from later assessments and revisions.
                // Only explicit sourced resolutions at owner acceptance discharge this guard.
                if a.blockers.iter().any(|b| {
                    !f.resolutions
                        .iter()
                        .any(|r| &r.blocker == b && !r.evidence.is_empty())
                }) || self
                    .actions
                    .values()
                    .any(|a| a.phase == ActionPhase::Dispatched)
                {
                    return Err(Error::Conflict);
                }
                let settled = Settlement::Fulfilled(f.agreement.clone());
                self.settlement = Some(settled.clone());
                Ok(Effect::Settled(settled))
            }
            Command::Withdraw { .. } => {
                self.owner(&v.authority)?;
                self.settlement = Some(Settlement::Withdrawn);
                Ok(Effect::Settled(Settlement::Withdrawn))
            }
            Command::Reconcile {
                action,
                grant,
                evidence,
                outcome,
            } => {
                let g = self.grant(grant, &v.authority)?;
                if !g.spec.actions.contains(&GrantAction::Reconcile)
                    || !matches!(&g.spec.target, GrantTarget::Reconciliation(actions) if actions.contains(action))
                    || !self.covers_content_items(g, v)
                {
                    return Err(Error::Denied);
                }
                nonempty(evidence)?;
                let a = self.actions.get_mut(action).ok_or(Error::Invalid)?;
                if a.phase == ActionPhase::Admitted {
                    return Err(Error::Conflict);
                }
                // Later evidence may leave an outcome unknown or correct an earlier claim; never replay.
                a.evidence.extend(evidence.clone());
                a.outcome = *outcome;
                a.phase = if *outcome == ActionOutcome::Unknown {
                    ActionPhase::Dispatched
                } else {
                    ActionPhase::Reconciled
                };
                Ok(Effect::Reconciled(action.clone()))
            }
        }
    }
}
