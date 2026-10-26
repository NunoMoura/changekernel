//! Typed conversions. Collections preserve lists and reject duplicate typed set/map members.
use super::{CodecError, Result, MAX_DEPTH, MAX_FRAME, MAX_MATERIAL, MAX_REPEATED};
use crate::unqualified_pursuit::*;
use std::collections::{BTreeMap, BTreeSet};

pub(super) trait Bridge: Sized {
    type Wire;
    fn pack(&self, budget: &mut Budget) -> Result<Self::Wire>;
    fn unpack(value: Self::Wire) -> Result<Self>;
}
pub(super) struct Budget {
    bytes: usize,
    depth: usize,
}
impl Budget {
    pub fn new() -> Self {
        Self { bytes: 8, depth: 1 }
    }
    pub fn charge(&mut self, bytes: usize) -> Result<()> {
        self.bytes = self.bytes.checked_add(bytes).ok_or(CodecError::Limit)?;
        if self.bytes > MAX_FRAME {
            return Err(CodecError::Limit);
        }
        Ok(())
    }
    pub fn message<T>(&mut self, f: impl FnOnce(&mut Self) -> Result<T>) -> Result<T> {
        self.depth += 1;
        if self.depth > MAX_DEPTH {
            return Err(CodecError::Limit);
        }
        let result = f(self);
        self.depth -= 1;
        result
    }
}
macro_rules! ids {
    ($($id:ident),+ $(,)?) => {$(impl Bridge for $id {
        type Wire = Vec<u8>;
        fn pack(&self, b: &mut Budget) -> Result<Self::Wire> { b.charge(16)?; Ok(self.as_bytes().to_vec()) }
        fn unpack(value: Self::Wire) -> Result<Self> {
            Self::from_bytes(value.try_into().map_err(|_| CodecError::Id)?).map_err(|_| CodecError::Id)
        }
    })+};
}
ids!(
    ActorId,
    OwnerId,
    LedgerId,
    ChangeId,
    ProposalId,
    AgreementId,
    AssessmentId,
    DecisionId,
    GrantId,
    ActionId,
    OperationId,
    MaterialId,
    GroundId,
    GroundVersion,
    CriterionId,
    ScopeId,
    LimitId,
    NativeActionId,
    ContextVersion
);
impl Bridge for u64 {
    type Wire = u64;
    fn pack(&self, _: &mut Budget) -> Result<u64> {
        Ok(*self)
    }
    fn unpack(value: u64) -> Result<Self> {
        Ok(value)
    }
}
impl Bridge for bool {
    type Wire = bool;
    fn pack(&self, _: &mut Budget) -> Result<bool> {
        Ok(*self)
    }
    fn unpack(value: bool) -> Result<Self> {
        Ok(value)
    }
}
impl Bridge for Vec<u8> {
    type Wire = Vec<u8>;
    fn pack(&self, b: &mut Budget) -> Result<Self> {
        if self.len() > MAX_MATERIAL {
            return Err(CodecError::Limit);
        }
        b.charge(self.len())?;
        Ok(self.clone())
    }
    fn unpack(value: Self) -> Result<Self> {
        if value.len() > MAX_MATERIAL {
            return Err(CodecError::Limit);
        }
        Ok(value)
    }
}
pub(super) fn required<T>(value: Option<T>) -> Result<T> {
    value.ok_or(CodecError::Presence)
}
pub(super) fn pack_optional<T: Bridge>(
    value: &Option<T>,
    b: &mut Budget,
) -> Result<Option<T::Wire>> {
    value.as_ref().map(|v| v.pack(b)).transpose()
}
pub(super) fn unpack_optional<T: Bridge>(value: Option<T::Wire>) -> Result<Option<T>> {
    value.map(T::unpack).transpose()
}
pub(super) fn pack_list<T: Bridge>(values: &[T], b: &mut Budget) -> Result<Vec<T::Wire>> {
    if values.len() > MAX_REPEATED {
        return Err(CodecError::Limit);
    }
    values.iter().map(|v| v.pack(b)).collect()
}
pub(super) fn unpack_list<T: Bridge>(values: Vec<T::Wire>) -> Result<Vec<T>> {
    if values.len() > MAX_REPEATED {
        return Err(CodecError::Limit);
    }
    values.into_iter().map(T::unpack).collect()
}
pub(super) fn pack_set<T: Bridge + Ord>(
    values: &BTreeSet<T>,
    b: &mut Budget,
) -> Result<Vec<T::Wire>> {
    if values.len() > MAX_REPEATED {
        return Err(CodecError::Limit);
    }
    values.iter().map(|v| v.pack(b)).collect()
}
pub(super) fn unpack_set<T: Bridge + Ord>(values: Vec<T::Wire>) -> Result<BTreeSet<T>> {
    let mut result = BTreeSet::new();
    if values.len() > MAX_REPEATED {
        return Err(CodecError::Limit);
    }
    for value in values {
        if !result.insert(T::unpack(value)?) {
            return Err(CodecError::Duplicate);
        }
    }
    Ok(result)
}
pub(super) trait Entry<K, V>: Sized {
    fn pack_entry(key: &K, value: &V, b: &mut Budget) -> Result<Self>;
    fn unpack_entry(self) -> Result<(K, V)>;
}
pub(super) fn pack_map<K: Ord, V, E: Entry<K, V>>(
    values: &BTreeMap<K, V>,
    b: &mut Budget,
) -> Result<Vec<E>> {
    if values.len() > MAX_REPEATED {
        return Err(CodecError::Limit);
    }
    values.iter().map(|(k, v)| E::pack_entry(k, v, b)).collect()
}
pub(super) fn unpack_map<K: Ord, V, E: Entry<K, V>>(values: Vec<E>) -> Result<BTreeMap<K, V>> {
    if values.len() > MAX_REPEATED {
        return Err(CodecError::Limit);
    }
    let mut result = BTreeMap::new();
    for entry in values {
        let (key, value) = entry.unpack_entry()?;
        if result.insert(key, value).is_some() {
            return Err(CodecError::Duplicate);
        }
    }
    Ok(result)
}
pub(super) fn check_fresh(values: &[FreshMaterial]) -> Result<()> {
    if values.len() > 64 {
        return Err(CodecError::Limit);
    }
    let mut bytes = 0usize;
    let mut ids = BTreeSet::new();
    for value in values {
        if value.bytes.len() > MAX_MATERIAL {
            return Err(CodecError::Limit);
        }
        bytes = bytes
            .checked_add(value.bytes.len())
            .ok_or(CodecError::Limit)?;
        if bytes > 8 * 1024 * 1024 {
            return Err(CodecError::Limit);
        }
        if !ids.insert(&value.id) {
            return Err(CodecError::Duplicate);
        }
    }
    Ok(())
}
