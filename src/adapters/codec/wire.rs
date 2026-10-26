//! Borrowing schema-aware preflight. No untrusted heap allocation or prost decode here.
use super::{CodecError, Result, SubmissionProfile, MAX_DEPTH, MAX_MATERIAL};

#[derive(Clone, Copy)]
pub(super) enum Shape {
    Id,
    Material,
    Uint,
    Bool,
    Version(u32),
    Enum(&'static [u64]),
    Message(fn() -> Schema),
}
#[derive(Clone, Copy)]
pub(super) struct Rule {
    pub tag: u32,
    pub shape: Shape,
    pub required: bool,
    pub repeated: bool,
    pub limit: usize,
    pub fresh: bool,
}
pub(super) struct Schema {
    pub fields: &'static [Rule],
    pub oneof: bool,
}
pub(super) trait WireSchema {
    fn schema() -> Schema;
}

pub(super) fn varint(input: &mut &[u8]) -> Result<u64> {
    let mut result = 0;
    for shift in (0..70).step_by(7) {
        let (&byte, rest) = input.split_first().ok_or(CodecError::Malformed)?;
        *input = rest;
        if shift == 63 && byte > 1 {
            return Err(CodecError::Malformed);
        }
        result |= u64::from(byte & 127) << shift;
        if byte & 128 == 0 {
            return Ok(result);
        }
    }
    Err(CodecError::Malformed)
}
fn chunk<'a>(input: &mut &'a [u8]) -> Result<&'a [u8]> {
    let len = usize::try_from(varint(input)?).map_err(|_| CodecError::Limit)?;
    let part = input.get(..len).ok_or(CodecError::Malformed)?;
    *input = &input[len..];
    Ok(part)
}
/// Inspect only the bounded top-level envelope. Opaque spans are borrowed/skipped,
/// never recursively scanned or decoded before the complete tuple is selected.
/// The subsequent schema scan still checks every field, payload, duplicate and bound.
pub(super) fn envelope(mut input: &[u8]) -> Result<SubmissionProfile> {
    let mut versions = [None; 3];
    while !input.is_empty() {
        let key = varint(&mut input)?;
        let tag = key >> 3;
        if tag == 0 || tag > 0x1fff_ffff {
            return Err(CodecError::Malformed);
        }
        let wire = key & 7;
        if (1..=3).contains(&tag) {
            if wire != 0 {
                return Err(CodecError::Wire);
            }
            let slot = &mut versions[(tag - 1) as usize];
            if slot.is_some() {
                return Err(CodecError::Duplicate);
            }
            *slot = Some(u32::try_from(varint(&mut input)?).map_err(|_| CodecError::Version)?);
        } else {
            match wire {
                0 => {
                    varint(&mut input)?;
                }
                2 => {
                    chunk(&mut input)?;
                }
                _ => return Err(CodecError::Wire),
            }
        }
    }
    let profile = SubmissionProfile {
        codec: versions[0].ok_or(CodecError::Presence)?,
        schema: versions[1].ok_or(CodecError::Presence)?,
        semantic: versions[2].ok_or(CodecError::Presence)?,
    };
    if !profile.is_current() {
        return Err(CodecError::Version);
    }
    Ok(profile)
}
fn scalar(shape: Shape, value: u64) -> Result<()> {
    match shape {
        Shape::Uint => Ok(()),
        Shape::Bool if value <= 1 => Ok(()),
        Shape::Version(expected) if value == u64::from(expected) => Ok(()),
        Shape::Version(_) => Err(CodecError::Version),
        Shape::Enum(known) if known.contains(&value) => Ok(()),
        Shape::Enum(_) | Shape::Bool => Err(CodecError::Enum),
        _ => Err(CodecError::Wire),
    }
}
/// Returns material byte count for the enclosing Operation.fresh field's local accounting.
/// Other copies in checks/origins do not recharge that logical creation budget.
pub(super) fn scan(mut input: &[u8], schema: Schema, depth: usize) -> Result<usize> {
    if depth > MAX_DEPTH {
        return Err(CodecError::Limit);
    }
    // Trusted schema has at most 32 fields; counts/seen bits never depend on untrusted allocation.
    if schema.fields.len() > 32 {
        return Err(CodecError::Malformed);
    }
    let mut counts = [0usize; 32];
    let mut fresh_bytes = [0usize; 32];
    let mut oneof_seen = false;
    let mut material_bytes = 0usize;
    while !input.is_empty() {
        let key = varint(&mut input)?;
        let tag = key >> 3;
        if tag == 0 || tag > 0x1fff_ffff {
            return Err(CodecError::Malformed);
        }
        let (index, rule) = schema
            .fields
            .iter()
            .enumerate()
            .find(|(_, r)| u64::from(r.tag) == tag)
            .ok_or(CodecError::UnknownField)?;
        if !rule.repeated && counts[index] != 0 {
            return Err(CodecError::Duplicate);
        }
        if schema.oneof {
            if oneof_seen {
                return Err(CodecError::Duplicate);
            }
            oneof_seen = true;
        }
        let wire = key & 7;
        // Protobuf permits both packed and unpacked repeated scalar encodings. Count actual
        // values, not just occurrences of their length-delimited container.
        if rule.repeated
            && wire == 2
            && matches!(rule.shape, Shape::Enum(_) | Shape::Uint | Shape::Bool)
        {
            let mut packed = chunk(&mut input)?;
            while !packed.is_empty() {
                counts[index] += 1;
                if counts[index] > rule.limit {
                    return Err(CodecError::Limit);
                }
                scalar(rule.shape, varint(&mut packed)?)?;
            }
            continue;
        }
        counts[index] += 1;
        if counts[index] > rule.limit {
            return Err(CodecError::Limit);
        }
        let bytes = match (rule.shape, wire) {
            (Shape::Id, 2) => {
                let id = chunk(&mut input)?;
                if id.len() != 16 || id.iter().all(|b| *b == 0) {
                    return Err(CodecError::Id);
                }
                0
            }
            (Shape::Material, 2) => {
                let bytes = chunk(&mut input)?;
                if bytes.len() > MAX_MATERIAL {
                    return Err(CodecError::Limit);
                }
                bytes.len()
            }
            (Shape::Message(child), 2) => scan(chunk(&mut input)?, child(), depth + 1)?,
            (shape @ (Shape::Uint | Shape::Bool | Shape::Version(_) | Shape::Enum(_)), 0) => {
                scalar(shape, varint(&mut input)?)?;
                0
            }
            _ => return Err(CodecError::Wire),
        };
        material_bytes = material_bytes.checked_add(bytes).ok_or(CodecError::Limit)?;
        if rule.fresh {
            fresh_bytes[index] = fresh_bytes[index]
                .checked_add(bytes)
                .ok_or(CodecError::Limit)?;
            if fresh_bytes[index] > 8 * 1024 * 1024 {
                return Err(CodecError::Limit);
            }
        }
    }
    if schema.oneof && !oneof_seen {
        return Err(CodecError::Presence);
    }
    if schema
        .fields
        .iter()
        .enumerate()
        .any(|(i, r)| r.required && counts[i] == 0)
    {
        return Err(CodecError::Presence);
    }
    Ok(material_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn recursive() -> Schema {
        Schema {
            oneof: false,
            fields: &[Rule {
                tag: 1,
                shape: Shape::Message(recursive),
                required: false,
                repeated: false,
                limit: 4096,
                fresh: false,
            }],
        }
    }
    #[test]
    fn depth_is_bounded_before_recursive_decode() {
        fn wrap(bytes: Vec<u8>) -> Vec<u8> {
            let mut result = vec![10, bytes.len() as u8];
            result.extend(bytes);
            result
        }
        let mut value = vec![];
        for _ in 0..31 {
            value = wrap(value);
        }
        assert!(scan(&value, recursive(), 1).is_ok());
        value = wrap(value);
        assert_eq!(scan(&value, recursive(), 1), Err(CodecError::Limit));
    }
}
