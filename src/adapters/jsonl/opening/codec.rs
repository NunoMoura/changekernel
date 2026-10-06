use super::super::intent_trace::assessment_work as observation;
use crate::kernel::changes::opening::{Opened, Origin, Request};
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::{fmt, io};

pub(crate) const LIMIT: usize = 1_048_576;
// Fixed-schema visitors: each outer slot records presence even for nullable fields.
macro_rules! shape {
    ($ty:ident { $($field:ident : $ft:ty),+ $(,)? }) => {
        impl<'de> Deserialize<'de> for $ty {
            fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                struct Fixed;
                impl<'de> Visitor<'de> for Fixed {
                    type Value = $ty;
                    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result { f.write_str(stringify!($ty)) }
                    fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<$ty, M::Error> {
                        $(let mut $field: Option<$ft> = None;)+
                        while let Some(k) = m.next_key::<String>()? {
                            observation::member_attempt(&k);
                            match k.as_str() {
                                $(stringify!($field) => {
                                    observation::member_complete(true);
                                    observation::field_attempt(0);
                                    let duplicate=$field.is_some();observation::field_complete(!duplicate);
                                    if duplicate { return Err(de::Error::duplicate_field(stringify!($field))); }
                                    $field = Some(m.next_value()?);
                                },)+
                                _ => { observation::member_complete(false); return Err(de::Error::custom("unknown field")); },
                            }
                        }
                        observation::field_attempt(0);
                        let complete=true $(&& $field.is_some())+;observation::field_complete(complete);
                        Ok($ty { $($field: $field.ok_or_else(|| de::Error::missing_field(stringify!($field)))?),+ })
                    }
                }
                d.deserialize_struct(stringify!($ty), &[$(stringify!($field)),+], Fixed)
            }
        }
        impl Serialize for $ty {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut out = s.serialize_struct(stringify!($ty), [$(stringify!($field)),+].len())?;
                $(out.serialize_field(stringify!($field), &self.$field)?;)+
                out.end()
            }
        }
    };
}
pub(crate) use shape;
shape!(Opened {
    v: u64,
    kind: String,
    workspace_id: String,
    change: String,
    key: String,
    actor: String,
    result: String,
    seq: u64
});
shape!(Origin { v: u64, custody: String, workspace_id: String, binding: String, change: String, seq: u64, prev: Option<String>, kind: String, input: Request, result: Opened });
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Pending {
    pub input: Request,
    pub actor: String,
}
shape!(Pending {
    input: Request,
    actor: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Prefix {
    pub format: String,
    pub custody: String,
    pub change: String,
    pub generation: u64,
    pub end: u64,
    pub sha256: Option<String>,
    pub pending: Option<Pending>,
}
shape!(Prefix { format: String, custody: String, change: String, generation: u64, end: u64, sha256: Option<String>, pending: Option<Pending> });
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Anchor {
    pub format: String,
    pub custody: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub owner: String,
    pub key: String,
    pub directory: String,
    pub directory_device: u64,
    pub directory_inode: u64,
    pub lock_device: u64,
    pub lock_inode: u64,
    pub stage: String,
}
impl Anchor {
    pub(crate) fn payload(&self) -> u64 {
        (self.format.len()
            + self.custody.len()
            + self.workspace_id.len()
            + self.binding.len()
            + self.change.len()
            + self.owner.len()
            + self.key.len()
            + self.directory.len()
            + self.stage.len()) as u64
    }
}
shape!(Anchor {
    format: String,
    custody: String,
    workspace_id: String,
    binding: String,
    change: String,
    owner: String,
    key: String,
    directory: String,
    directory_device: u64,
    directory_inode: u64,
    lock_device: u64,
    lock_inode: u64,
    stage: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Incident {
    pub format: String,
    pub custody: String,
    pub state: String,
    pub phase: Option<String>,
    pub issue: Option<String>,
}
impl Incident {
    pub(crate) fn payload(&self) -> u64 {
        (self.format.len()
            + self.custody.len()
            + self.state.len()
            + self.phase.as_ref().map_or(0, String::len)
            + self.issue.as_ref().map_or(0, String::len)) as u64
    }
}
// Clear and blocked have different, closed field sets. Presence is not inferred from null.
impl<'de> Deserialize<'de> for Incident {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Fixed;
        impl<'de> Visitor<'de> for Fixed {
            type Value = Incident;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("incident")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Incident, M::Error> {
                let (mut format, mut custody, mut state, mut phase, mut issue) =
                    (None, None, None, None, None);
                while let Some(k) = m.next_key::<String>()? {
                    observation::member_attempt(&k);
                    let slot = match k.as_str() {
                        "format" => &mut format,
                        "custody" => &mut custody,
                        "state" => &mut state,
                        "phase" => &mut phase,
                        "issue" => &mut issue,
                        _ => {
                            observation::member_complete(false);
                            return Err(de::Error::custom("unknown field"));
                        }
                    };
                    observation::member_complete(true);
                    observation::field_attempt(0);
                    let duplicate = slot.is_some();
                    observation::field_complete(!duplicate);
                    if duplicate {
                        return Err(de::Error::custom("duplicate field"));
                    }
                    *slot = Some(m.next_value::<String>()?);
                }
                observation::field_attempt(0);
                let state = match state {
                    Some(state) => {
                        observation::field_complete(true);
                        state
                    }
                    None => {
                        observation::field_complete(false);
                        return Err(de::Error::missing_field("state"));
                    }
                };
                observation::field_attempt(12);
                let shape = matches!(
                    (state.as_str(), phase.is_some(), issue.is_some()),
                    ("clear", false, false) | ("blocked", true, true)
                );
                observation::field_complete(shape);
                if !shape {
                    return Err(de::Error::custom("incident shape"));
                }
                observation::field_attempt(0);
                let format = match format {
                    Some(format) => {
                        observation::field_complete(true);
                        format
                    }
                    None => {
                        observation::field_complete(false);
                        return Err(de::Error::missing_field("format"));
                    }
                };
                observation::field_attempt(0);
                let custody = match custody {
                    Some(custody) => {
                        observation::field_complete(true);
                        custody
                    }
                    None => {
                        observation::field_complete(false);
                        return Err(de::Error::missing_field("custody"));
                    }
                };
                Ok(Incident {
                    format,
                    custody,
                    state,
                    phase,
                    issue,
                })
            }
        }
        d.deserialize_struct(
            "incident",
            &["format", "custody", "state", "phase", "issue"],
            Fixed,
        )
    }
}
impl Serialize for Incident {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("incident", if self.state == "clear" { 3 } else { 5 })?;
        o.serialize_field("format", &self.format)?;
        o.serialize_field("custody", &self.custody)?;
        o.serialize_field("state", &self.state)?;
        if let Some(v) = &self.phase {
            o.serialize_field("phase", v)?;
        }
        if let Some(v) = &self.issue {
            o.serialize_field("issue", v)?;
        }
        o.end()
    }
}
impl<'de> Deserialize<'de> for Request {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Fixed;
        impl<'de> Visitor<'de> for Fixed {
            type Value = Request;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("opening request")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Request, M::Error> {
                let mut v = None;
                let (mut op, mut workspace_id, mut change, mut key, mut what) =
                    (None, None, None, None, None);
                let mut why: Option<Option<String>> = None;
                let mut seen = 0u8;
                while let Some(k) = m.next_key::<String>()? {
                    let bit = match k.as_str() {
                        "v" => 1,
                        "op" => 2,
                        "workspace_id" => 4,
                        "change" => 8,
                        "key" => 16,
                        "what" => 32,
                        "why" => 64,
                        _ => return Err(de::Error::custom("unknown field")),
                    };
                    if seen & bit != 0 {
                        return Err(de::Error::custom("duplicate field"));
                    }
                    seen |= bit;
                    match bit {
                        1 => v = Some(m.next_value::<u64>()?),
                        2 => op = Some(m.next_value::<String>()?),
                        4 => workspace_id = Some(m.next_value::<String>()?),
                        8 => change = Some(m.next_value::<String>()?),
                        16 => key = Some(m.next_value::<String>()?),
                        32 => what = Some(m.next_value::<String>()?),
                        64 => why = Some(m.next_value::<Option<String>>()?),
                        _ => unreachable!(),
                    }
                }
                let r = Request {
                    v: v.ok_or_else(|| de::Error::missing_field("v"))?,
                    op: op.ok_or_else(|| de::Error::missing_field("op"))?,
                    workspace_id: workspace_id
                        .ok_or_else(|| de::Error::missing_field("workspace_id"))?,
                    change: change.ok_or_else(|| de::Error::missing_field("change"))?,
                    key,
                    what,
                    why,
                };
                if !r.valid() {
                    return Err(de::Error::custom("unsupported request shape or value"));
                }
                Ok(r)
            }
        }
        d.deserialize_struct(
            "request",
            &["v", "op", "workspace_id", "change", "key", "what", "why"],
            Fixed,
        )
    }
}
impl Serialize for Request {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("request", if self.op == "open_change" { 7 } else { 4 })?;
        o.serialize_field("v", &self.v)?;
        o.serialize_field("op", &self.op)?;
        o.serialize_field("workspace_id", &self.workspace_id)?;
        o.serialize_field("change", &self.change)?;
        if let Some(k) = &self.key {
            o.serialize_field("key", k)?;
        }
        if let Some(w) = &self.what {
            o.serialize_field("what", w)?;
        }
        if let Some(w) = &self.why {
            o.serialize_field("why", w)?;
        }
        o.end()
    }
}
struct Canonical;
impl serde_json::ser::Formatter for Canonical {
    fn write_char_escape<W: io::Write + ?Sized>(
        &mut self,
        w: &mut W,
        c: serde_json::ser::CharEscape,
    ) -> io::Result<()> {
        use serde_json::ser::CharEscape::*;
        let b = match c {
            Quote => return w.write_all(b"\\\""),
            ReverseSolidus => return w.write_all(b"\\\\"),
            Solidus => return w.write_all(b"/"),
            Backspace => 8,
            FormFeed => 12,
            LineFeed => 10,
            CarriageReturn => 13,
            Tab => 9,
            AsciiControl(b) => b,
        };
        const HEX: &[u8] = b"0123456789abcdef";
        w.write_all(&[
            b'\\',
            b'u',
            b'0',
            b'0',
            HEX[(b >> 4) as usize],
            HEX[(b & 15) as usize],
        ])
    }
}
pub(crate) fn emit<T: Serialize>(v: &T) -> Result<Vec<u8>, ()> {
    emit_bounded(v, LIMIT)
}
pub(crate) fn emit_query<T: Serialize>(v: &T) -> Result<Vec<u8>, ()> {
    emit_bounded(v, 2_097_152)
}
pub(crate) fn emit_bounded<T: Serialize>(v: &T, limit: usize) -> Result<Vec<u8>, ()> {
    emit_observed(v, limit, None)
}
pub(crate) fn emit_observed<T: Serialize>(
    v: &T,
    limit: usize,
    capacity: Option<&dyn Fn(usize)>,
) -> Result<Vec<u8>, ()> {
    emit_stream(limit, capacity, |out| out.value(v))
}
pub(crate) struct Bounded<'a> {
    bytes: Vec<u8>,
    limit: usize,
    capacity: Option<&'a dyn Fn(usize)>,
}
impl io::Write for Bounded<'_> {
    fn write(&mut self, b: &[u8]) -> io::Result<usize> {
        let end = self
            .bytes
            .len()
            .checked_add(b.len())
            .filter(|n| *n < self.limit)
            .ok_or_else(|| {
                if self.capacity.is_some() {
                    io::Error::from(io::ErrorKind::FileTooLarge)
                } else {
                    io::Error::other("output bound")
                }
            })?;
        if end > self.bytes.capacity() {
            let capacity = end
                .max(self.bytes.capacity().saturating_mul(2))
                .min(self.limit);
            self.bytes.reserve_exact(capacity - self.bytes.len());
            if let Some(observe) = self.capacity {
                observe(self.bytes.capacity());
            }
        }
        self.bytes.extend_from_slice(b);
        Ok(b.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Bounded<'_> {
    pub(crate) fn raw(&mut self, bytes: &[u8]) -> Result<(), ()> {
        io::Write::write_all(self, bytes).map_err(|_| ())
    }
    pub(crate) fn value<T: Serialize + ?Sized>(&mut self, value: &T) -> Result<(), ()> {
        value
            .serialize(&mut serde_json::Serializer::with_formatter(self, Canonical))
            .map_err(|_| ())
    }
}
pub(crate) fn emit_stream(
    limit: usize,
    capacity: Option<&dyn Fn(usize)>,
    fill: impl FnOnce(&mut Bounded<'_>) -> Result<(), ()>,
) -> Result<Vec<u8>, ()> {
    let mut out = Bounded {
        bytes: Vec::new(),
        limit,
        capacity,
    };
    fill(&mut out)?;
    out.bytes.push(b'\n');
    if let Some(observe) = capacity {
        observe(out.bytes.capacity());
    }
    Ok(out.bytes)
}
pub(crate) fn decode<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, ()> {
    observation::field_attempt(0);
    let bounded = bytes.len() <= LIMIT;
    observation::field_complete(bounded);
    if !bounded {
        return Err(());
    }
    let mut d = serde_json::Deserializer::from_slice(bytes);
    let value = T::deserialize(&mut d).map_err(|_| ())?;
    d.end().map_err(|_| ())?;
    Ok(value)
}
/// Fixed retained-codec boundaries; completion does not imply byte equality or
/// contextual validity. No emission is attempted when decoding fails.
#[derive(Clone, Copy, Default)]
pub(crate) struct RetainedWork {
    pub decode_attempts: u64,
    pub decodes: u64,
    pub emission_attempts: u64,
    pub emissions: u64,
}
pub(crate) fn retained<T: for<'de> Deserialize<'de> + Serialize>(b: &[u8]) -> Result<T, ()> {
    retained_counted(b, &mut RetainedWork::default())
}
pub(crate) fn retained_counted<T: for<'de> Deserialize<'de> + Serialize>(
    b: &[u8],
    work: &mut RetainedWork,
) -> Result<T, ()> {
    observation::retained_decode_attempt();
    work.decode_attempts += 1;
    let v = decode(b)?;
    observation::retained_decode_complete();
    work.decodes += 1;
    observation::retained_emit_attempt();
    work.emission_attempts += 1;
    let emitted = emit(&v)?;
    observation::retained_emit_complete();
    work.emissions += 1;
    observation::canonical_attempt(emitted.len().max(b.len()) as u64);
    let equal = emitted == b;
    observation::canonical_complete(equal);
    if !equal {
        return Err(());
    }
    Ok(v)
}
pub(super) struct Inspection<'a> {
    pub origin: &'a Origin,
    pub tail: bool,
}
impl Serialize for Inspection<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        struct Coverage;
        impl Serialize for Coverage {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                let mut o = s.serialize_struct("coverage", 2)?;
                o.serialize_field("first", &1u64)?;
                o.serialize_field("last", &1u64)?;
                o.end()
            }
        }
        let mut o = s.serialize_struct("inspection", 5)?;
        o.serialize_field("v", &1u64)?;
        o.serialize_field("kind", "inspection")?;
        o.serialize_field("origin", self.origin)?;
        o.serialize_field("coverage", &Coverage)?;
        o.serialize_field(
            "progress",
            if self.tail {
                "blocked_unaccepted_tail"
            } else {
                "ready"
            },
        )?;
        o.end()
    }
}
