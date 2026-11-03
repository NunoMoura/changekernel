//! Identified payloads and their provenance, retention and access rules.
//! Content need not be a document and implies no evidence, truth or approval. It is not a core primitive.
use super::model::{
    Access, ActorId, Authority, Command, ContentKey, ContentReference, Error, Grant, GrantSpec,
    GrantTarget, GrantUse, Identity, Operation, OwnerId, Result, State, Validation,
};
use std::collections::{BTreeMap, BTreeSet};

/// Caller-supplied attribution is a claim, not authorship, approval or native observation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FreshContent {
    pub key: ContentKey,
    pub derived_from: BTreeSet<ContentReference>,
    pub bytes: Vec<u8>,
    pub attributed_source: ActorId,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentLimits {
    pub items: u64,
    /// Logical payload bytes, not references, identity handles or encoding overhead.
    pub payload_bytes: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentUsage {
    pub items: u64,
    pub payload_bytes: u64,
}
impl ContentUsage {
    pub fn measure<'a>(payloads: impl IntoIterator<Item = &'a FreshContent>) -> Result<Self> {
        let mut usage = Self {
            items: 0,
            payload_bytes: 0,
        };
        for payload in payloads {
            usage.items = usage.items.checked_add(1).ok_or(Error::Invalid)?;
            usage.payload_bytes = usage
                .payload_bytes
                .checked_add(u64::try_from(payload.bytes.len()).map_err(|_| Error::Invalid)?)
                .ok_or(Error::Invalid)?;
        }
        Ok(usage)
    }
    pub fn within(&self, limits: &ContentLimits) -> bool {
        self.items <= limits.items && self.payload_bytes <= limits.payload_bytes
    }
}
/// Exact generation/target scope. Only accepted origins can satisfy a selection.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct OriginScope {
    pub identity: Identity,
    pub grant: GrantUse,
    pub target: GrantTarget,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ContentOrigin {
    pub binding: ContentReference,
    pub recorder: ActorId,
    pub represented_owner: OwnerId,
    pub grant: GrantUse,
    pub target: GrantTarget,
}
impl ContentOrigin {
    pub fn scope(&self) -> OriginScope {
        OriginScope {
            identity: self.binding.identity.clone(),
            grant: self.grant.clone(),
            target: self.target.clone(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum OriginSelector {
    /// This consuming grant's own generation and target, including future acceptances.
    CurrentGrant,
    /// One already accepted origin, not another grant's future contents.
    Historical(Box<ContentOrigin>),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RecordedContent {
    pub payload: FreshContent,
    pub origin: ContentOrigin,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentCreation {
    pub grant: Grant,
    pub content_items: BTreeMap<ContentKey, RecordedContent>,
    pub usage: ContentUsage,
}
impl State {
    pub(crate) fn prepare_creation(
        &self,
        operation: &Operation,
        authority: &Authority,
    ) -> Result<Option<ContentCreation>> {
        if operation.fresh.is_empty() {
            return Ok(None);
        }
        let used = match &operation.command {
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
            | Command::Reconcile { grant: g, .. } => g,
            _ => return Err(Error::Denied),
        };
        let grant = self.grant(used, authority)?;
        let limits = grant.spec.creation.as_ref().ok_or(Error::Denied)?;
        let usage = ContentUsage::measure(&operation.fresh)?;
        if !usage.within(limits) {
            return Err(Error::Denied);
        }
        let mut content_items = BTreeMap::new();
        for payload in &operation.fresh {
            if payload.key.establishing != self.identity.change_key() {
                return Err(Error::Unavailable);
            }
            if self.content_items.contains_key(&payload.key)
                || content_items.contains_key(&payload.key)
            {
                return Err(Error::Conflict);
            }
            content_items.insert(
                payload.key.clone(),
                RecordedContent {
                    payload: payload.clone(),
                    origin: ContentOrigin {
                        binding: ContentReference {
                            identity: self.identity.clone(),
                            operation: operation.id.clone(),
                            content: payload.key.clone(),
                        },
                        recorder: authority.actor.clone(),
                        represented_owner: authority.represented_owner.clone(),
                        grant: used.clone(),
                        target: grant.spec.target.clone(),
                    },
                },
            );
        }
        Ok(Some(ContentCreation {
            grant: grant.clone(),
            content_items,
            usage,
        }))
    }

    fn selected_origin(
        &self,
        id: &ContentKey,
        grant: &Grant,
        selectors: &BTreeSet<OriginSelector>,
    ) -> bool {
        let Some(recorded) = self.created.get(id) else {
            return false;
        };
        let origin = &recorded.origin;
        origin.binding.identity == self.identity
            && selectors.iter().any(|selector| match selector {
                OriginSelector::CurrentGrant => {
                    origin.grant.id == grant.id
                        && origin.grant.generation == grant.generation
                        && origin.target == grant.spec.target
                }
                OriginSelector::Historical(exact) => origin == exact.as_ref(),
            })
    }
    pub(super) fn covers_content_items(&self, grant: &Grant, v: &Validation) -> bool {
        v.content_items.iter().all(|id| {
            v.fresh.contains(id)
                || grant.spec.content_items.contains(id)
                || self.selected_origin(id, grant, &grant.spec.content_origins)
        })
    }
    pub(super) fn discloses_content(&self, grant: &Grant, id: &ContentKey) -> bool {
        grant.spec.disclosure.contains(id)
            || self.selected_origin(id, grant, &grant.spec.disclosure_origins)
    }
    pub(super) fn validate_origin_selectors(&self, spec: &GrantSpec) -> Result<()> {
        for selector in spec.content_origins.iter().chain(&spec.disclosure_origins) {
            if let OriginSelector::Historical(origin) = selector {
                if origin.binding.content.establishing != self.identity.change_key() {
                    return Err(Error::Unavailable);
                }
                if origin.binding.identity != self.identity
                    || self.created.get(&origin.binding.content).map(|r| &r.origin)
                        != Some(origin.as_ref())
                {
                    return Err(Error::Denied);
                }
            }
        }
        Ok(())
    }
}

/// Trusted observations are not caller proof or an authentic native-source implementation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InputKind {
    NewContribution,
    PreExisting,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BindingKnowledge {
    NoKnownBinding,
    Known(ContentKey),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Attribution {
    Unknown,
    Actor(ActorId),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceClaim {
    pub input_kind: InputKind,
    pub binding_knowledge: BindingKnowledge,
    pub attribution: Attribution,
    /// Explicit limitations/uncertainty; bounded to 1 MiB by the codec, also within its frame cap.
    pub limitations: Vec<u8>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum IntakeCase {
    Fresh,
    FirstRetention,
    KnownReuse,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IntakeSnapshot {
    pub case: IntakeCase,
    pub source_claim: SourceClaim,
    pub prior_establishment: Option<ContentReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentEstablishment {
    pub binding: ContentReference,
    pub original: IntakeSnapshot,
    pub recorder: ActorId,
    pub represented_owner: OwnerId,
    pub grant: Option<GrantUse>,
    pub target: Option<GrantTarget>,
}
impl SourceClaim {
    /// Knowledge/kind legitimately change after establishment. These facts do not.
    pub fn same_stable_facts(&self, other: &Self) -> bool {
        self.attribution == other.attribution && self.limitations == other.limitations
    }
}
