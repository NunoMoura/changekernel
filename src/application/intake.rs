use crate::kernel::containers::intake::{self, Issue, Proposal, Receipt, Result};
use crate::ports::container_intake::ContainerIntakeStore;

/// Actor must come from trusted host authentication, not from submitted content.
pub struct Intake<S: ContainerIntakeStore> {
    store: S,
}
impl<S: ContainerIntakeStore> Intake<S> {
    pub fn new(store: S) -> Self {
        Self { store }
    }
    fn actor(actor: &str) -> Result<()> {
        if intake::identifier(actor) {
            Ok(())
        } else {
            Err(Issue::Denied)
        }
    }
    pub fn create(&mut self, container: &str, actor: &str) -> Result<()> {
        Self::actor(actor)?;
        if !intake::identifier(container) {
            return Err(Issue::InvalidInput);
        }
        self.store.create(container, actor)
    }
    pub fn open(&self, container: &str, actor: &str) -> Result<()> {
        Self::actor(actor)?;
        if !intake::identifier(container) {
            return Err(Issue::InvalidInput);
        }
        self.store.open(container, actor)
    }
    pub fn propose(&mut self, proposal: &Proposal, actor: &str) -> Result<Receipt> {
        Self::actor(actor)?;
        intake::validate(proposal)?;
        self.store.propose(proposal, actor)
    }
    pub fn read(&self, container: &str, change_id: &str, actor: &str) -> Result<Receipt> {
        Self::actor(actor)?;
        if !intake::identifier(container)
            || change_id.len() != 64
            || !change_id.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(Issue::InvalidInput);
        }
        self.store.read(container, change_id, actor)
    }
}
