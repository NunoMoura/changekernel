use crate::kernel::containers::intake::{Proposal, Receipt, Result};

/// Atomic custody boundary. Host supplies authenticated actor, never proposal content.
pub trait ContainerIntakeStore {
    fn create(&mut self, container: &str, actor: &str) -> Result<()>;
    fn open(&self, container: &str, actor: &str) -> Result<()>;
    fn propose(&mut self, proposal: &Proposal, actor: &str) -> Result<Receipt>;
    fn read(&self, container: &str, change_id: &str, actor: &str) -> Result<Receipt>;
}
