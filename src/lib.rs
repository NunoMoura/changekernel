//! Unqualified Rust source library with bounded local persistence.
//! The Change surface is an in-process core, not a supported host/durable-service SDK.
//! No authentic host/source enforcement or native-action execution is implemented.
pub mod adapters;
mod application;
mod kernel;
pub mod unqualified_change;
