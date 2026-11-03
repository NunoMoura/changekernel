//! Explicit public semantic projection. No StoredOperation, Checks, Context or custody input.
use super::adapter_error::AdapterError;
use super::projection::Projection;
use crate::application::read;
use crate::kernel::change as domain;
use serde_json::Value;

type Output = Result<Value, AdapterError>;

impl Projection {
    pub(super) fn key(&self, key: &domain::ChangeKey) -> Output {
        self.object([
            ("owner", self.hex(key.owner.as_bytes())?),
            ("ledger", self.hex(key.ledger.as_bytes())?),
            ("change", self.hex(key.change.as_bytes())?),
        ])
    }
    pub(super) fn identity(&self, id: &domain::Identity) -> Output {
        self.object([
            ("owner", self.hex(id.owner.as_bytes())?),
            ("owner_actor", self.hex(id.owner_actor.as_bytes())?),
            ("ledger", self.hex(id.ledger.as_bytes())?),
            ("change", self.hex(id.change.as_bytes())?),
            ("agent", self.hex(id.agent.as_bytes())?),
        ])
    }
    pub(super) fn content_key(&self, key: &domain::ContentKey) -> Output {
        self.object([
            ("establishing", self.key(&key.establishing)?),
            ("id", self.hex(key.id.as_bytes())?),
        ])
    }
    pub(super) fn membership(&self, value: &domain::ContentReference) -> Output {
        self.object([
            ("identity", self.identity(&value.identity)?),
            ("operation", self.hex(value.operation.as_bytes())?),
            ("content", self.content_key(&value.content)?),
        ])
    }
    pub(super) fn position(&self, value: &read::ChangePosition) -> Output {
        self.object([
            (
                "source",
                self.object([
                    ("identity", self.identity(&value.source.identity)?),
                    (
                        "profile",
                        self.object([
                            ("codec", self.small(value.source.profile.codec)?),
                            ("schema", self.small(value.source.profile.schema)?),
                            ("semantic", self.small(value.source.profile.semantic)?),
                        ])?,
                    ),
                ])?,
            ),
            ("sequence", self.decimal(value.sequence)?),
            (
                "operation",
                self.optional(value.operation.as_ref(), |id| self.hex(id.as_bytes()))?,
            ),
        ])
    }
    pub(super) fn range(&self, value: &read::ChangeRange) -> Output {
        self.object([
            ("after", self.position(&value.after)?),
            ("through", self.position(&value.through)?),
        ])
    }
    fn reference(&self, value: &read::QualifiedReference) -> Output {
        use read::QualifiedReference;
        match value {
            QualifiedReference::Change(key) => self.object([("Change", self.key(key)?)]),
            QualifiedReference::Content(key) => self.object([("Content", self.content_key(key)?)]),
            QualifiedReference::Membership(m) => self.object([("Membership", self.membership(m)?)]),
            QualifiedReference::Operation(r) => self.object([(
                "Operation",
                self.object([
                    ("change", self.key(&r.change)?),
                    ("operation", self.hex(r.operation.as_bytes())?),
                ])?,
            )]),
            QualifiedReference::GroundObservation {
                change,
                ground,
                version,
            } => self.object([(
                "GroundObservation",
                self.object([
                    ("change", self.key(change)?),
                    ("ground", self.hex(ground.as_bytes())?),
                    ("version", self.hex(version.as_bytes())?),
                ])?,
            )]),
        }
    }
    fn kind(&self, value: read::OperationKind) -> Output {
        use read::OperationKind;
        self.text(match value {
            OperationKind::Start => "Start",
            OperationKind::Propose => "Propose",
            OperationKind::Assess => "Assess",
            OperationKind::Decide => "Decide",
            OperationKind::Retract => "Retract",
            OperationKind::Reaffirm => "Reaffirm",
            OperationKind::SetGrant => "SetGrant",
            OperationKind::RevokeGrant => "RevokeGrant",
            OperationKind::Admit => "Admit",
            OperationKind::Dispatch => "Dispatch",
            OperationKind::Finding => "Finding",
            OperationKind::Adapt => "Adapt",
            OperationKind::Progress => "Progress",
            OperationKind::Fulfill => "Fulfill",
            OperationKind::Withdraw => "Withdraw",
            OperationKind::Reconcile => "Reconcile",
        })
    }
    pub(super) fn selection(&self, value: &read::RecordSelection) -> Output {
        match value {
            read::RecordSelection::AllRecords => self.text("AllRecords"),
            read::RecordSelection::MatchingRecords(m) => self.object([(
                "MatchingRecords",
                self.object([
                    ("kinds", self.array(m.kinds.iter(), |k| self.kind(*k))?),
                    (
                        "operations",
                        self.array(m.operations.iter(), |o| {
                            self.object([
                                ("change", self.key(&o.change)?),
                                ("operation", self.hex(o.operation.as_bytes())?),
                            ])
                        })?,
                    ),
                    (
                        "actors",
                        self.array(m.actors.iter(), |a| {
                            self.object([
                                ("change", self.key(&a.change)?),
                                ("actor", self.hex(a.actor.as_bytes())?),
                            ])
                        })?,
                    ),
                    (
                        "references",
                        self.array(m.references.iter(), |r| self.reference(r))?,
                    ),
                ])?,
            )]),
        }
    }
    pub(super) fn cursor(&self, value: &read::ChangePageCursor) -> Output {
        self.object([
            ("range", self.range(&value.range)?),
            ("selection", self.selection(&value.selection)?),
            ("reader", self.hex(value.reader.as_bytes())?),
            ("permission_scope", self.key(&value.permission_scope)?),
            ("last_scanned", self.position(&value.last_scanned)?),
        ])
    }
    pub(super) fn page(&self, page: &read::ChangePage) -> Output {
        let progress = match &page.progress {
            read::ChangeProgress::EndOfRange => self.text("EndOfRange")?,
            read::ChangeProgress::More { next_page_cursor } => self.object([(
                "More",
                self.object([("next_page_cursor", self.cursor(next_page_cursor)?)])?,
            )])?,
        };
        self.object([
            (
                "records",
                self.array(page.records.iter(), |r| self.record(r))?,
            ),
            ("scanned", self.range(&page.scanned)?),
            ("observed_head", self.position(&page.observed_head)?),
            ("progress", progress),
        ])
    }
    pub(super) fn record(&self, record: &read::PublicRecord) -> Output {
        self.object([
            ("position", self.position(&record.position)?),
            ("command", self.command(&record.command)?),
            ("accepted", self.accepted(&record.accepted)?),
            (
                "used_grant",
                self.optional(record.used_grant.as_ref(), |g| self.grant_use(g))?,
            ),
            (
                "memberships",
                self.array(record.memberships.iter(), |m| {
                    self.object([
                        ("reference", self.membership(&m.reference)?),
                        ("intake", self.intake(&m.intake)?),
                        (
                            "attributed_source",
                            self.optional(m.attributed_source.as_ref(), |id| {
                                self.hex(id.as_bytes())
                            })?,
                        ),
                        (
                            "derived_from",
                            self.array(m.derived_from.iter(), |r| self.membership(r))?,
                        ),
                        (
                            "origin",
                            self.optional(m.origin.as_ref(), |o| {
                                self.object([
                                    ("grant", self.grant_use(&o.grant)?),
                                    ("target", self.target(&o.target)?),
                                ])
                            })?,
                        ),
                    ])
                })?,
            ),
            (
                "discretion_evidence",
                self.optional(record.discretion_evidence.as_ref(), |e| self.evidence(e))?,
            ),
            (
                "native_evidence",
                self.optional(record.native_evidence.as_ref(), |e| {
                    self.object([
                        ("action", self.hex(e.action.as_bytes())?),
                        (
                            "evidence",
                            self.array(e.evidence.iter(), |v| self.evidence(v))?,
                        ),
                    ])
                })?,
            ),
            (
                "ground_observations",
                self.array(record.ground_observations.iter(), |(ground, version)| {
                    self.object([
                        ("ground", self.hex(ground.as_bytes())?),
                        ("version", self.hex(version.as_bytes())?),
                    ])
                })?,
            ),
        ])
    }
    fn intake(&self, value: &domain::IntakeSnapshot) -> Output {
        let case = match value.case {
            domain::IntakeCase::Fresh => "Fresh",
            domain::IntakeCase::FirstRetention => "FirstRetention",
            domain::IntakeCase::KnownReuse => "KnownReuse",
        };
        self.object([
            ("case", self.text(case)?),
            ("source_claim", self.source_claim(&value.source_claim)?),
            (
                "prior_establishment",
                self.optional(value.prior_establishment.as_ref(), |m| self.membership(m))?,
            ),
        ])
    }
    fn source_claim(&self, value: &domain::SourceClaim) -> Output {
        let input_kind = match value.input_kind {
            domain::InputKind::NewContribution => "NewContribution",
            domain::InputKind::PreExisting => "PreExisting",
        };
        let binding = match &value.binding_knowledge {
            domain::BindingKnowledge::NoKnownBinding => self.text("NoKnownBinding")?,
            domain::BindingKnowledge::Known(key) => {
                self.object([("Known", self.content_key(key)?)])?
            }
        };
        let attribution = match &value.attribution {
            domain::Attribution::Unknown => self.text("Unknown")?,
            domain::Attribution::Actor(actor) => {
                self.object([("Actor", self.hex(actor.as_bytes())?)])?
            }
        };
        self.object([
            ("input_kind", self.text(input_kind)?),
            ("binding_knowledge", binding),
            ("attribution", attribution),
            ("limitations", self.bytes(&value.limitations)?),
        ])
    }
    fn grant_use(&self, value: &domain::GrantUse) -> Output {
        self.object([
            ("id", self.hex(value.id.as_bytes())?),
            ("generation", self.decimal(value.generation)?),
        ])
    }
    fn target(&self, value: &domain::GrantTarget) -> Output {
        use domain::GrantTarget;
        match value {
            GrantTarget::DraftCreation(id) => {
                self.object([("DraftCreation", self.hex(id.as_bytes())?)])
            }
            GrantTarget::Draft(id) => self.object([("Draft", self.hex(id.as_bytes())?)]),
            GrantTarget::Pursuit(id) => self.object([("Pursuit", self.hex(id.as_bytes())?)]),
            GrantTarget::Reconciliation(ids) => self.object([(
                "Reconciliation",
                self.array(ids.iter(), |id| self.hex(id.as_bytes()))?,
            )]),
        }
    }
    fn origin(&self, value: &domain::OriginSelector) -> Output {
        match value {
            domain::OriginSelector::CurrentGrant => self.text("CurrentGrant"),
            domain::OriginSelector::Historical(o) => self.object([(
                "Historical",
                self.object([
                    ("binding", self.membership(&o.binding)?),
                    ("recorder", self.hex(o.recorder.as_bytes())?),
                    (
                        "represented_owner",
                        self.hex(o.represented_owner.as_bytes())?,
                    ),
                    ("grant", self.grant_use(&o.grant)?),
                    ("target", self.target(&o.target)?),
                ])?,
            )]),
        }
    }
    fn grant_action(&self, value: domain::GrantAction) -> Output {
        use domain::GrantAction;
        self.text(match value {
            GrantAction::CreateDraft => "CreateDraft",
            GrantAction::Propose => "Propose",
            GrantAction::Assess => "Assess",
            GrantAction::Finding => "Finding",
            GrantAction::Adapt => "Adapt",
            GrantAction::Progress => "Progress",
            GrantAction::Admit => "Admit",
            GrantAction::Dispatch => "Dispatch",
            GrantAction::Reconcile => "Reconcile",
        })
    }
    fn grant_spec(&self, value: &domain::GrantSpec) -> Output {
        self.object([
            ("recipient", self.hex(value.recipient.as_bytes())?),
            ("target", self.target(&value.target)?),
            (
                "actions",
                self.array(value.actions.iter(), |v| self.grant_action(*v))?,
            ),
            (
                "content_items",
                self.array(value.content_items.iter(), |v| self.content_key(v))?,
            ),
            (
                "disclosure",
                self.array(value.disclosure.iter(), |v| self.content_key(v))?,
            ),
            (
                "creation",
                self.optional(value.creation.as_ref(), |v| {
                    self.object([
                        ("items", self.decimal(v.items)?),
                        ("payload_bytes", self.decimal(v.payload_bytes)?),
                    ])
                })?,
            ),
            (
                "content_origins",
                self.array(value.content_origins.iter(), |v| self.origin(v))?,
            ),
            (
                "disclosure_origins",
                self.array(value.disclosure_origins.iter(), |v| self.origin(v))?,
            ),
            (
                "native_actions",
                self.array(value.native_actions.iter(), |id| self.hex(id.as_bytes()))?,
            ),
            (
                "native_scope",
                self.array(value.native_scope.iter(), |id| self.hex(id.as_bytes()))?,
            ),
            (
                "limits",
                self.array(value.limits.iter(), |id| self.hex(id.as_bytes()))?,
            ),
        ])
    }
    fn access(&self, value: &domain::Access) -> Output {
        match value {
            domain::Access::Owner => self.text("Owner"),
            domain::Access::Grant(grant) => self.object([("Grant", self.grant_use(grant)?)]),
        }
    }
    fn dependency(&self, value: &domain::Dependency) -> Output {
        self.object([
            ("ground", self.hex(value.ground.as_bytes())?),
            ("version", self.hex(value.version.as_bytes())?),
        ])
    }
    fn evidence(&self, value: &domain::Evidence) -> Output {
        self.object([
            ("source", self.hex(value.source.as_bytes())?),
            ("content", self.content_key(&value.content)?),
            ("limitations", self.content_key(&value.limitations)?),
        ])
    }
    fn terms(&self, value: &domain::Terms) -> Output {
        self.object([
            (
                "binding",
                self.array(value.binding.iter(), |term| {
                    self.object([
                        ("statement", self.membership(&term.statement)?),
                        (
                            "context",
                            self.array(term.context.iter(), |r| self.membership(r))?,
                        ),
                    ])
                })?,
            ),
            (
                "context",
                self.array(value.context.iter(), |r| self.membership(r))?,
            ),
            (
                "unknowns",
                self.array(value.unknowns.iter(), |u| {
                    self.object([
                        ("question", self.content_key(&u.question)?),
                        ("bounded_by", self.content_key(&u.bounded_by)?),
                        (
                            "affected",
                            self.array(u.affected.iter(), |r| self.membership(r))?,
                        ),
                    ])
                })?,
            ),
            (
                "criteria",
                self.array(value.criteria.iter(), |c| {
                    self.object([
                        ("id", self.hex(c.id.as_bytes())?),
                        ("definition", self.membership(&c.definition)?),
                        ("terms", self.array(c.terms.iter(), |r| self.membership(r))?),
                    ])
                })?,
            ),
        ])
    }
    fn proposal(&self, value: &domain::Proposal) -> Output {
        self.object([
            ("id", self.hex(value.id.as_bytes())?),
            ("agreement", self.hex(value.agreement.as_bytes())?),
            ("identity", self.identity(&value.identity)?),
            (
                "expected_agreement",
                self.optional(value.expected_agreement.as_ref(), |id| {
                    self.hex(id.as_bytes())
                })?,
            ),
            ("terms", self.terms(&value.terms)?),
            (
                "dependencies",
                self.array(value.dependencies.iter(), |d| self.dependency(d))?,
            ),
        ])
    }
    fn assessment(&self, value: &domain::Assessment) -> Output {
        self.object([
            ("id", self.hex(value.id.as_bytes())?),
            ("proposal", self.hex(value.proposal.as_bytes())?),
            ("feasibility", self.content_key(&value.feasibility)?),
            ("capabilities", self.content_key(&value.capabilities)?),
            ("resources", self.content_key(&value.resources)?),
            ("commitments", self.content_key(&value.commitments)?),
            ("coverage", self.content_key(&value.coverage)?),
            ("limitations", self.content_key(&value.limitations)?),
            (
                "dependencies",
                self.array(value.dependencies.iter(), |d| self.dependency(d))?,
            ),
            (
                "blockers",
                self.array(value.blockers.iter(), |c| self.content_key(c))?,
            ),
        ])
    }
    fn decision(&self, value: &domain::Decision) -> Output {
        let kind = match &value.kind {
            domain::DecisionKind::Adopt => self.text("Adopt")?,
            domain::DecisionKind::Undertake { assessment } => self.object([(
                "Undertake",
                self.object([("assessment", self.hex(assessment.as_bytes())?)])?,
            )])?,
        };
        self.object([
            ("id", self.hex(value.id.as_bytes())?),
            ("proposal", self.hex(value.proposal.as_bytes())?),
            ("kind", kind),
            (
                "dependencies",
                self.array(value.dependencies.iter(), |d| self.dependency(d))?,
            ),
        ])
    }
    fn action_request(&self, value: &domain::ActionRequest) -> Output {
        self.object([
            ("id", self.hex(value.id.as_bytes())?),
            ("agreement", self.hex(value.agreement.as_bytes())?),
            ("grant", self.grant_use(&value.grant)?),
            ("native_action", self.hex(value.native_action.as_bytes())?),
            (
                "scope",
                self.array(value.scope.iter(), |id| self.hex(id.as_bytes()))?,
            ),
            (
                "limits",
                self.array(value.limits.iter(), |id| self.hex(id.as_bytes()))?,
            ),
            (
                "dependencies",
                self.array(value.dependencies.iter(), |d| self.dependency(d))?,
            ),
            (
                "conditions",
                self.array(value.conditions.iter(), |c| self.content_key(c))?,
            ),
        ])
    }
    fn finding(&self, value: &domain::Finding) -> Output {
        let disposition = match value.disposition {
            domain::Disposition::Supports => "Supports",
            domain::Disposition::Challenges => "Challenges",
            domain::Disposition::Unknown => "Unknown",
        };
        self.object([
            (
                "agreement",
                self.optional(value.agreement.as_ref(), |id| self.hex(id.as_bytes()))?,
            ),
            ("claim", self.content_key(&value.claim)?),
            (
                "evidence",
                self.array(value.evidence.iter(), |e| self.evidence(e))?,
            ),
            ("disposition", self.text(disposition)?),
        ])
    }
    fn adaptation(&self, value: &domain::Adaptation) -> Output {
        self.object([
            ("agreement", self.hex(value.agreement.as_bytes())?),
            (
                "previous_approach",
                self.content_key(&value.previous_approach)?,
            ),
            (
                "changed_approach",
                self.content_key(&value.changed_approach)?,
            ),
            (
                "grounds",
                self.array(value.grounds.iter(), |e| self.evidence(e))?,
            ),
            ("discretion", self.hex(value.discretion.as_bytes())?),
        ])
    }
    fn dimension(&self, value: &domain::ProgressDimension) -> Output {
        let label = match value.value {
            domain::ProgressValue::Advanced => "Advanced",
            domain::ProgressValue::Unchanged => "Unchanged",
            domain::ProgressValue::Regressed => "Regressed",
            domain::ProgressValue::Unknown => "Unknown",
        };
        self.object([
            ("value", self.text(label)?),
            ("assessment", self.content_key(&value.assessment)?),
        ])
    }
    fn progress(&self, value: &domain::Progress) -> Output {
        let basis = match value.basis {
            domain::ChangeBasis::Observation => "Observation",
            domain::ChangeBasis::CorrectedUnderstanding => "CorrectedUnderstanding",
            domain::ChangeBasis::RevisedTargets => "RevisedTargets",
        };
        self.object([
            ("agreement", self.hex(value.agreement.as_bytes())?),
            (
                "terms",
                self.array(value.terms.iter(), |m| self.membership(m))?,
            ),
            (
                "criteria",
                self.array(value.criteria.iter(), |id| self.hex(id.as_bytes()))?,
            ),
            (
                "evidence",
                self.array(value.evidence.iter(), |e| self.evidence(e))?,
            ),
            ("understanding", self.dimension(&value.understanding)?),
            ("outcome", self.dimension(&value.outcome)?),
            ("basis", self.text(basis)?),
        ])
    }
    fn fulfillment(&self, value: &domain::Fulfillment) -> Output {
        self.object([
            ("agreement", self.hex(value.agreement.as_bytes())?),
            (
                "criteria",
                self.array(value.criteria.iter(), |c| {
                    self.object([
                        ("criterion", self.hex(c.criterion.as_bytes())?),
                        (
                            "evidence",
                            self.array(c.evidence.iter(), |e| self.evidence(e))?,
                        ),
                    ])
                })?,
            ),
            (
                "resolutions",
                self.array(value.resolutions.iter(), |r| {
                    self.object([
                        ("blocker", self.content_key(&r.blocker)?),
                        (
                            "evidence",
                            self.array(r.evidence.iter(), |e| self.evidence(e))?,
                        ),
                    ])
                })?,
            ),
            ("acceptance", self.content_key(&value.acceptance)?),
        ])
    }
    fn outcome(&self, value: domain::ActionOutcome) -> Output {
        self.text(match value {
            domain::ActionOutcome::Unknown => "Unknown",
            domain::ActionOutcome::ReportedApplied => "ReportedApplied",
            domain::ActionOutcome::ReportedNotApplied => "ReportedNotApplied",
            domain::ActionOutcome::ReportedPartial => "ReportedPartial",
        })
    }
    pub(super) fn command(&self, command: &domain::Command) -> Output {
        use domain::Command;
        match command {
            Command::Initiate { wish, access } => self.object([(
                "Initiate",
                self.object([
                    ("wish", self.content_key(wish)?),
                    ("access", self.access(access)?),
                ])?,
            )]),
            Command::Propose { proposal, access } => self.object([(
                "Propose",
                self.object([
                    ("proposal", self.proposal(proposal)?),
                    ("access", self.access(access)?),
                ])?,
            )]),
            Command::Assess { assessment, access } => self.object([(
                "Assess",
                self.object([
                    ("assessment", self.assessment(assessment)?),
                    ("access", self.access(access)?),
                ])?,
            )]),
            Command::Decide(decision) => self.object([("Decide", self.decision(decision)?)]),
            Command::Retract { decision } => self.object([(
                "Retract",
                self.object([("decision", self.hex(decision.as_bytes())?)])?,
            )]),
            Command::Reaffirm {
                decision,
                dependencies,
                assessment,
            } => self.object([(
                "Reaffirm",
                self.object([
                    ("decision", self.hex(decision.as_bytes())?),
                    (
                        "dependencies",
                        self.array(dependencies.iter(), |d| self.dependency(d))?,
                    ),
                    (
                        "assessment",
                        self.optional(assessment.as_ref(), |id| self.hex(id.as_bytes()))?,
                    ),
                ])?,
            )]),
            Command::SetGrant {
                id,
                expected_generation,
                spec,
            } => self.object([(
                "SetGrant",
                self.object([
                    ("id", self.hex(id.as_bytes())?),
                    (
                        "expected_generation",
                        self.optional(expected_generation.as_ref(), |n| self.decimal(*n))?,
                    ),
                    ("spec", self.grant_spec(spec)?),
                ])?,
            )]),
            Command::RevokeGrant {
                id,
                expected_generation,
            } => self.object([(
                "RevokeGrant",
                self.object([
                    ("id", self.hex(id.as_bytes())?),
                    ("expected_generation", self.decimal(*expected_generation)?),
                ])?,
            )]),
            Command::Admit(request) => self.object([("Admit", self.action_request(request)?)]),
            Command::Dispatch { action } => self.object([(
                "Dispatch",
                self.object([("action", self.hex(action.as_bytes())?)])?,
            )]),
            Command::Finding { finding, access } => self.object([(
                "Finding",
                self.object([
                    ("finding", self.finding(finding)?),
                    ("access", self.access(access)?),
                ])?,
            )]),
            Command::Adapt { adaptation, access } => self.object([(
                "Adapt",
                self.object([
                    ("adaptation", self.adaptation(adaptation)?),
                    ("access", self.access(access)?),
                ])?,
            )]),
            Command::Progress { progress, access } => self.object([(
                "Progress",
                self.object([
                    ("progress", self.progress(progress)?),
                    ("access", self.access(access)?),
                ])?,
            )]),
            Command::Fulfill(value) => self.object([("Fulfill", self.fulfillment(value)?)]),
            Command::Withdraw { reason } => self.object([(
                "Withdraw",
                self.object([("reason", self.content_key(reason)?)])?,
            )]),
            Command::Reconcile {
                action,
                grant,
                evidence,
                outcome,
            } => self.object([(
                "Reconcile",
                self.object([
                    ("action", self.hex(action.as_bytes())?),
                    ("grant", self.grant_use(grant)?),
                    (
                        "evidence",
                        self.array(evidence.iter(), |e| self.evidence(e))?,
                    ),
                    ("outcome", self.outcome(*outcome)?),
                ])?,
            )]),
        }
    }
    pub(super) fn accepted(&self, value: &domain::Accepted) -> Output {
        self.object([
            ("operation", self.hex(value.operation.as_bytes())?),
            ("actor", self.hex(value.actor.as_bytes())?),
            (
                "represented_owner",
                self.hex(value.represented_owner.as_bytes())?,
            ),
            ("effect", self.effect(&value.effect)?),
        ])
    }
    pub(super) fn effect(&self, value: &domain::Effect) -> Output {
        use domain::Effect;
        match value {
            Effect::Initiated => self.text("Initiated"),
            Effect::Proposed(id) => self.object([("Proposed", self.hex(id.as_bytes())?)]),
            Effect::Assessed(id) => self.object([("Assessed", self.hex(id.as_bytes())?)]),
            Effect::Decision {
                decision,
                activated,
            } => self.object([(
                "Decision",
                self.object([
                    ("decision", self.hex(decision.as_bytes())?),
                    (
                        "activated",
                        self.optional(activated.as_ref(), |id| self.hex(id.as_bytes()))?,
                    ),
                ])?,
            )]),
            Effect::Retracted(id) => self.object([("Retracted", self.hex(id.as_bytes())?)]),
            Effect::Reaffirmed {
                decision,
                activated,
            } => self.object([(
                "Reaffirmed",
                self.object([
                    ("decision", self.hex(decision.as_bytes())?),
                    (
                        "activated",
                        self.optional(activated.as_ref(), |id| self.hex(id.as_bytes()))?,
                    ),
                ])?,
            )]),
            Effect::Grant(grant) => self.object([("Grant", self.grant_use(grant)?)]),
            Effect::Revoked(grant) => self.object([("Revoked", self.grant_use(grant)?)]),
            Effect::Admitted(id) => self.object([("Admitted", self.hex(id.as_bytes())?)]),
            Effect::Dispatched(id) => self.object([("Dispatched", self.hex(id.as_bytes())?)]),
            Effect::Recorded => self.text("Recorded"),
            Effect::Settled(settlement) => self.object([(
                "Settled",
                match settlement {
                    domain::Settlement::Fulfilled(id) => {
                        self.object([("Fulfilled", self.hex(id.as_bytes())?)])?
                    }
                    domain::Settlement::Withdrawn => self.text("Withdrawn")?,
                },
            )]),
            Effect::Reconciled(id) => self.object([("Reconciled", self.hex(id.as_bytes())?)]),
        }
    }
}

#[cfg(test)]
#[path = "public_projection_tests.rs"]
mod tests;
