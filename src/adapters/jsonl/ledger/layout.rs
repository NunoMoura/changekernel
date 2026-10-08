//! Compile-time owner selection. Legacy custody never owns native proof state.
use super::{
    codec::LegacyPhysical,
    continuity::{
        identity::{Identity, Pair, Shared},
        receipt::Receipt,
        LedgerContinuityIoEvent, LedgerContinuityIoFault, LedgerContinuityIoHook,
        LedgerIdentityObject, LedgerIdentityStep,
    },
    storage::{LedgerIoEvent, LedgerIoFault, LedgerIoHook},
    work::Heap,
};
use crate::adapters::jsonl::opening::storage::Failure;
use serde_core::{de::DeserializeOwned, Serialize};
use std::{cell::Cell, fmt::Debug};

pub(crate) trait Slot<T: Copy>: Default {
    fn get(&self) -> Option<T>;
    fn set(&self, value: Option<T>);
    fn take(&self) -> Option<T> {
        let value = self.get();
        self.set(None);
        value
    }
}
impl<T: Copy> Slot<T> for () {
    fn get(&self) -> Option<T> {
        None
    }
    fn set(&self, _: Option<T>) {}
}
impl<T: Copy> Slot<T> for Cell<Option<T>> {
    fn get(&self) -> Option<T> {
        Cell::get(self)
    }
    fn set(&self, value: Option<T>) {
        Cell::set(self, value)
    }
}
pub(crate) trait Value<T: Copy>: Heap + Copy + Debug + Eq {
    fn value(self) -> Option<T>;
    fn from_value(value: Option<T>) -> Self;
}
impl<T: Copy> Value<T> for () {
    fn value(self) -> Option<T> {
        None
    }
    fn from_value(_: Option<T>) -> Self {}
}
impl<T: Copy + Debug + Eq + Heap> Value<T> for Option<T> {
    fn value(self) -> Option<T> {
        self
    }
    fn from_value(value: Option<T>) -> Self {
        value
    }
}
impl Heap for () {
    fn heap(&self) -> usize {
        0
    }
}

pub(crate) trait SharedFields: Default {
    fn put(&mut self, field: usize, identity: Identity);
    fn finish(self) -> Option<Shared>;
}
impl SharedFields for () {
    fn put(&mut self, _: usize, _: Identity) {}
    fn finish(self) -> Option<Shared> {
        None
    }
}
impl SharedFields for [Option<Identity>; 3] {
    fn put(&mut self, field: usize, identity: Identity) {
        self[field] = Some(identity);
    }
    fn finish(self) -> Option<Shared> {
        Some(Shared {
            directory: self[0]?,
            lock: self[1]?,
            members: self[2]?,
        })
    }
}
pub(crate) trait Layout: Clone + Copy + Debug + Eq + 'static {
    type Physical: Clone + Debug + Eq + Heap + Serialize + DeserializeOwned;
    type Shared: Value<Shared>;
    type SharedFields: SharedFields;
    type Member: Value<Pair>;
    type ReceiptSlot: Slot<Receipt>;
    type Charge;
    fn charge(bytes: usize) -> Self::Charge;
    type Hook;
    fn legacy(value: &Self::Physical) -> &LegacyPhysical;
    fn physical(legacy: LegacyPhysical, native: Option<Pair>) -> Result<Self::Physical, Failure>;
    fn file(hook: &mut Self::Hook, event: LedgerIoEvent) -> Result<LedgerIoFault, Failure>;
    fn identity(
        hook: &mut Self::Hook,
        scope: u8,
        object: LedgerIdentityObject,
        step: LedgerIdentityStep,
    ) -> LedgerContinuityIoFault;
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Legacy;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Native;
impl Layout for Legacy {
    type Physical = LegacyPhysical;
    type Shared = ();
    type SharedFields = ();
    type Member = ();
    type ReceiptSlot = ();
    type Charge = ();
    fn charge(_: usize) {}
    type Hook = Option<LedgerIoHook>;
    fn legacy(value: &Self::Physical) -> &LegacyPhysical {
        value
    }
    fn physical(legacy: LegacyPhysical, _: Option<Pair>) -> Result<Self::Physical, Failure> {
        Ok(legacy)
    }
    fn file(hook: &mut Self::Hook, event: LedgerIoEvent) -> Result<LedgerIoFault, Failure> {
        Ok(hook.as_mut().map_or(LedgerIoFault::Continue, |h| h(event)))
    }
    fn identity(
        _: &mut Self::Hook,
        _: u8,
        _: LedgerIdentityObject,
        _: LedgerIdentityStep,
    ) -> LedgerContinuityIoFault {
        LedgerContinuityIoFault::Refuse
    }
}
impl Layout for Native {
    type Physical = Pair;
    type Shared = Option<Shared>;
    type SharedFields = [Option<Identity>; 3];
    type Member = Option<Pair>;
    type ReceiptSlot = Cell<Option<Receipt>>;
    type Charge = super::work::Fixed;
    fn charge(bytes: usize) -> Self::Charge {
        super::work::Fixed::new(bytes)
    }
    type Hook = Option<LedgerContinuityIoHook>;
    fn legacy(_: &Self::Physical) -> &LegacyPhysical {
        static ZERO: LegacyPhysical = LegacyPhysical {
            directory_device: 0,
            directory_inode: 0,
            lock_device: 0,
            lock_inode: 0,
        };
        &ZERO
    }
    fn physical(_: LegacyPhysical, native: Option<Pair>) -> Result<Self::Physical, Failure> {
        native.ok_or_else(Failure::damage)
    }
    fn file(hook: &mut Self::Hook, event: LedgerIoEvent) -> Result<LedgerIoFault, Failure> {
        match hook
            .as_mut()
            .map_or(LedgerContinuityIoFault::Continue, |h| {
                h(LedgerContinuityIoEvent::File(event))
            }) {
            LedgerContinuityIoFault::Continue => Ok(LedgerIoFault::Continue),
            LedgerContinuityIoFault::Io => Ok(LedgerIoFault::Io),
            LedgerContinuityIoFault::ShortWrite => Ok(LedgerIoFault::ShortWrite),
            LedgerContinuityIoFault::Refuse => Ok(LedgerIoFault::Refuse),
            _ => Err(Failure::damage()),
        }
    }
    fn identity(
        hook: &mut Self::Hook,
        scope: u8,
        object: LedgerIdentityObject,
        step: LedgerIdentityStep,
    ) -> LedgerContinuityIoFault {
        hook.as_mut()
            .map_or(LedgerContinuityIoFault::Continue, |h| {
                h(LedgerContinuityIoEvent::Identity {
                    scope,
                    object,
                    step,
                })
            })
    }
}
