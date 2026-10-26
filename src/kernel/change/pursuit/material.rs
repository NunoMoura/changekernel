use super::*;

/// Caller-supplied attribution is a claim, not authorship, approval or native observation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FreshMaterial {
    pub id: MaterialId,
    pub bytes: Vec<u8>,
    pub attributed_source: ActorId,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MaterialLimits {
    pub items: u64,
    /// Logical payload bytes, not references, identity handles or encoding overhead.
    pub payload_bytes: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MaterialUsage {
    pub items: u64,
    pub payload_bytes: u64,
}
impl MaterialUsage {
    pub fn measure<'a>(payloads: impl IntoIterator<Item = &'a FreshMaterial>) -> Result<Self> {
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
    pub fn within(&self, limits: &MaterialLimits) -> bool {
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
pub struct MaterialOrigin {
    pub binding: MaterialReference,
    pub recorder: ActorId,
    pub represented_owner: OwnerId,
    pub grant: GrantUse,
    pub target: GrantTarget,
}
impl MaterialOrigin {
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
    Historical(MaterialOrigin),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RecordedMaterial {
    pub payload: FreshMaterial,
    pub origin: MaterialOrigin,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MaterialCreation {
    pub grant: Grant,
    pub materials: BTreeMap<MaterialId, RecordedMaterial>,
    pub usage: MaterialUsage,
}
impl State {
    pub(crate) fn prepare_creation(
        &self,
        operation: &Operation,
        authority: &Authority,
    ) -> Result<Option<MaterialCreation>> {
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
        let usage = MaterialUsage::measure(&operation.fresh)?;
        if !usage.within(limits) {
            return Err(Error::Denied);
        }
        let mut materials = BTreeMap::new();
        for payload in &operation.fresh {
            if self.materials.contains_key(&payload.id) || materials.contains_key(&payload.id) {
                return Err(Error::Conflict);
            }
            materials.insert(
                payload.id.clone(),
                RecordedMaterial {
                    payload: payload.clone(),
                    origin: MaterialOrigin {
                        binding: MaterialReference {
                            identity: self.identity.clone(),
                            operation: operation.id.clone(),
                            material: payload.id.clone(),
                        },
                        recorder: authority.actor.clone(),
                        represented_owner: authority.represented_owner.clone(),
                        grant: used.clone(),
                        target: grant.spec.target.clone(),
                    },
                },
            );
        }
        Ok(Some(MaterialCreation {
            grant: grant.clone(),
            materials,
            usage,
        }))
    }

    fn selected_origin(
        &self,
        id: &MaterialId,
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
                OriginSelector::Historical(exact) => origin == exact,
            })
    }
    pub(super) fn covers_materials(&self, grant: &Grant, v: &Validation) -> bool {
        v.materials.iter().all(|id| {
            v.fresh.contains(id)
                || grant.spec.materials.contains(id)
                || self.selected_origin(id, grant, &grant.spec.material_origins)
        })
    }
    pub(super) fn discloses_material(&self, grant: &Grant, id: &MaterialId) -> bool {
        grant.spec.disclosure.contains(id)
            || self.selected_origin(id, grant, &grant.spec.disclosure_origins)
    }
    pub(super) fn validate_origin_selectors(&self, spec: &GrantSpec) -> Result<()> {
        for selector in spec.material_origins.iter().chain(&spec.disclosure_origins) {
            if let OriginSelector::Historical(origin) = selector {
                if origin.binding.identity != self.identity
                    || self
                        .created
                        .get(&origin.binding.material)
                        .map(|r| &r.origin)
                        != Some(origin)
                {
                    return Err(Error::Denied);
                }
            }
        }
        Ok(())
    }
}
