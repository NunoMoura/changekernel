//! Fixture-only structured reads. No host binding, service transport or agent authority.
//!
//! See [`read_fixture`] for the shared example, representation, bounds and error contract.
mod adapter_error;
mod fixture_read;
mod object_record;
mod projection;
mod public_projection;
mod request;
mod request_values;
mod response;
mod work;

pub use adapter_error::AdapterError;
pub use fixture_read::read_fixture;

#[cfg(test)]
mod test_values;
