//! Strict bounded current-format length-framed Protobuf.
mod bridge;
mod framing;
mod read_framing;
mod read_messages;
mod read_variants;
mod typed;
mod wire;
pub(crate) use framing::{public_record_weight, record_read_cost, request_read_cost};

pub use read_framing::{
    decode_read_call, decode_read_reply, encode_read_call, encode_read_reply, READ_PROTOCOL_VERSION,
};
pub(crate) use read_framing::{decode_read_call_bounded, read_call_header};

pub use framing::{
    decode_record, decode_request, encode_record, encode_request, CodecError, CODEC_VERSION,
    SCHEMA_VERSION,
};
