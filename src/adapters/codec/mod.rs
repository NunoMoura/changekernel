//! Frozen JSON compatibility codec, shared by the JSONL store and process adapter.
use crate::{application::ports::*, kernel::change::intent::*};
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::{fmt, io};
pub const LIMIT: usize = 262_144;
#[cfg(test)]
mod tests;
pub(crate) mod version_scan;
macro_rules! value_codec {
    ($name:ident { $($field:ident : $ty:ty),+ $(,)? }) => {
        impl Serialize for $name {
            fn serialize<S: Serializer>(&self,s:S)->std::result::Result<S::Ok,S::Error>{
                let mut o=s.serialize_struct(stringify!($name),0 $(+ {let _=stringify!($field);1})+)?;
                $(o.serialize_field(stringify!($field),&self.$field)?;)+ o.end()
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(d:D)->std::result::Result<Self,D::Error>{
                struct Fields;
                impl<'de> Visitor<'de> for Fields {
                    type Value=$name;
                    fn expecting(&self,f:&mut fmt::Formatter)->fmt::Result{f.write_str(stringify!($name))}
                    fn visit_map<M:MapAccess<'de>>(self,mut m:M)->std::result::Result<$name,M::Error>{
                        $(let mut $field: Option<$ty>=None;)+
                        while let Some(k)=m.next_key::<String>()? { match k.as_str(){
                            $(stringify!($field)=> {if $field.is_some(){return Err(de::Error::custom("duplicate field"));} $field=Some(m.next_value()?);},)+
                            _=>return Err(de::Error::custom("unknown field")),
                        }}
                        Ok($name{$($field:$field.ok_or_else(||de::Error::missing_field(stringify!($field)))?),+})
                    }
                }
                d.deserialize_map(Fields)
            }
        }
    }
}
pub(crate) use value_codec;
macro_rules! closed {
    ($name:ident { $($field:ident : $ty:ty),+ $(,)? }) => {
        #[derive(Clone, Debug, PartialEq, Eq)]
        pub struct $name { $(pub $field: $ty),+ }
        value_codec!($name { $($field: $ty),+ });
    }
}
pub(crate) use closed;
value_codec!(Material {
    custody: String,
    sha256: String,
    bytes: u64,
    text: String
});
value_codec!(Fact {
    ledger: String,
    change: String,
    seq: u64
});
value_codec!(Intent { what:Material, why:Option<Material> });
value_codec!(Lease {
    principal: String,
    disclose: String,
    mutate: String
});
value_codec!(Grant {
    version: String,
    custody: String,
    ledger: String,
    change: String,
    owner: String,
    coverage: String,
    policy: Material,
    directory: String,
    anchor: String
});
value_codec!(Record { version:String, custody:String, seq:u64, prev:Option<Fact>, input:Request, approval:Material });
value_codec!(Pending {
    input: Request,
    approval: Material
});
closed!(Prefix { format:String, custody:String, generation:u64, end:u64, sha256:Option<String>, pending:Option<Pending> });
impl Prefix {
    pub fn empty() -> Self {
        Self {
            format: "ck-ref-prefix".into(),
            custody: "custody-1".into(),
            generation: 0,
            end: 0,
            sha256: None,
            pending: None,
        }
    }
}
value_codec!(Previous { fact:Fact, what_text:String, why_text:Option<String> });
value_codec!(Review { format:String, input:Request, policy_text:String, previous:Option<Previous>, instruction_text:String, what_text:String, why_text:Option<String> });
value_codec!(Receipt {
    format: String,
    principal: String,
    subject_sha256: String,
    presentation: Material,
    decision: String,
    ui: String
});
value_codec!(Outcome { format:String, version:String, kind:String, key:String, actor:String, fact:Fact, previous:Option<Fact> });
impl Serialize for Request {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        let fields = match self.op.as_str() {
            "open_intent" | "read_history" => 7,
            "revise_intent" => 8,
            _ => 5,
        };
        let mut o = s.serialize_struct("request", fields)?;
        o.serialize_field("version", V)?;
        o.serialize_field("op", &self.op)?;
        o.serialize_field("ledger", "ledger-1")?;
        o.serialize_field("change", "change-1")?;
        match self.op.as_str() {
            "open_intent" | "revise_intent" => {
                o.serialize_field("key", &self.key)?;
                if self.op == "revise_intent" {
                    o.serialize_field("expected", &self.expected)?;
                }
                o.serialize_field("instruction", &self.instruction)?;
                o.serialize_field("replacement", &self.replacement)?;
            }
            "retain_text" => o.serialize_field("text", &self.text)?,
            "read_context" => o.serialize_field("at", &self.at)?,
            "read_history" => {
                o.serialize_field("through", &self.through)?;
                o.serialize_field("after", &self.after)?;
                o.serialize_field("limit", &self.limit)?;
            }
            "resolve_text" => o.serialize_field("material", &self.material)?,
            "inspect_operation" => o.serialize_field("key", &self.key)?,
            _ => return Err(serde_core::ser::Error::custom("operation")),
        }
        o.end()
    }
}
impl<'de> Deserialize<'de> for Request {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        struct Fields;
        impl<'de> Visitor<'de> for Fields {
            type Value = Request;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed request")
            }
            fn visit_map<M: MapAccess<'de>>(
                self,
                mut m: M,
            ) -> std::result::Result<Request, M::Error> {
                let mut r = Request {
                    op: String::new(),
                    key: None,
                    expected: None,
                    instruction: None,
                    replacement: None,
                    text: None,
                    at: None,
                    through: None,
                    after: None,
                    limit: None,
                    material: None,
                };
                let mut seen = 0u32;
                while let Some(k) = m.next_key::<String>()? {
                    let names = [
                        "version",
                        "op",
                        "ledger",
                        "change",
                        "key",
                        "expected",
                        "instruction",
                        "replacement",
                        "text",
                        "at",
                        "through",
                        "after",
                        "limit",
                        "material",
                    ];
                    let i = names
                        .iter()
                        .position(|n| *n == k)
                        .ok_or_else(|| de::Error::custom("unknown request field"))?;
                    if seen & (1 << i) != 0 {
                        return Err(de::Error::custom("duplicate request field"));
                    }
                    seen |= 1 << i;
                    match i {
                        0 => {
                            if m.next_value::<String>()? != V {
                                return Err(de::Error::custom("version"));
                            }
                        }
                        1 => r.op = m.next_value()?,
                        2 => {
                            if m.next_value::<String>()? != "ledger-1" {
                                return Err(de::Error::custom("ledger"));
                            }
                        }
                        3 => {
                            if m.next_value::<String>()? != "change-1" {
                                return Err(de::Error::custom("change"));
                            }
                        }
                        4 => r.key = Some(m.next_value()?),
                        5 => r.expected = Some(m.next_value()?),
                        6 => r.instruction = Some(m.next_value()?),
                        7 => r.replacement = Some(m.next_value()?),
                        8 => r.text = Some(m.next_value()?),
                        9 => r.at = m.next_value()?,
                        10 => r.through = m.next_value()?,
                        11 => r.after = Some(m.next_value()?),
                        12 => r.limit = Some(m.next_value()?),
                        13 => r.material = Some(m.next_value()?),
                        _ => unreachable!(),
                    }
                }
                let fields = match r.op.as_str() {
                    "open_intent" => 0b11010000,
                    "revise_intent" => 0b11110000,
                    "retain_text" => 1 << 8,
                    "read_context" => 1 << 9,
                    "read_history" => (1 << 10) | (1 << 11) | (1 << 12),
                    "resolve_text" => 1 << 13,
                    "inspect_operation" => 1 << 4,
                    _ => return Err(de::Error::custom("unsupported operation")),
                };
                if seen != fields | 15
                    || r.key.as_ref().is_some_and(|s| !key(s))
                    || r.expected.as_ref().is_some_and(|f| !f.valid())
                    || r.at.as_ref().is_some_and(|f| !f.valid())
                    || r.through.as_ref().is_some_and(|f| !f.valid())
                    || r.instruction.as_ref().is_some_and(|v| !v.valid())
                    || r.replacement.as_ref().is_some_and(|v| !v.valid())
                    || r.material.as_ref().is_some_and(|v| !v.valid())
                    || r.text.as_ref().is_some_and(|s| s.len() > 65_536)
                    || r.after.is_some_and(|n| n > 128)
                    || r.limit.is_some_and(|n| !(1..=8).contains(&n))
                {
                    return Err(de::Error::custom("request shape or bounds"));
                }
                Ok(r)
            }
        }
        d.deserialize_map(Fields)
    }
}
struct Canonical;
impl serde_json::ser::Formatter for Canonical {
    fn write_char_escape<W: io::Write + ?Sized>(
        &mut self,
        w: &mut W,
        ch: serde_json::ser::CharEscape,
    ) -> io::Result<()> {
        use serde_json::ser::CharEscape::*;
        let b = match ch {
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
        const H: &[u8] = b"0123456789abcdef";
        w.write_all(&[
            b'\\',
            b'u',
            b'0',
            b'0',
            H[(b >> 4) as usize],
            H[(b & 15) as usize],
        ])
    }
}
pub fn emit<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    let mut b = Vec::new();
    value
        .serialize(&mut serde_json::Serializer::with_formatter(
            &mut b, Canonical,
        ))
        .map_err(|_| Error::Invalid)?;
    b.push(b'\n');
    if b.len() > LIMIT {
        return Err(Error::Unsupported);
    }
    Ok(b)
}
pub fn parse<T: de::DeserializeOwned>(bytes: &[u8]) -> Result<T> {
    if bytes.is_empty() || bytes.len() > LIMIT {
        return Err(Error::Invalid);
    }
    let mut d = serde_json::Deserializer::from_slice(bytes);
    let t = T::deserialize(&mut d).map_err(|e| {
        if e.to_string().starts_with("unsupported operation")
            || e.to_string().starts_with("unsupported version")
        {
            Error::Unsupported
        } else {
            Error::Invalid
        }
    })?;
    d.end().map_err(|_| Error::Invalid)?;
    Ok(t)
}
pub fn versioned_canonical<T: de::DeserializeOwned + Serialize>(bytes: &[u8]) -> Result<T> {
    parse::<version_scan::VersionScan>(bytes).map_err(|e| {
        if e == Error::Unsupported {
            e
        } else {
            Error::Unavailable
        }
    })?;
    canonical(bytes)
}
pub fn canonical<T: de::DeserializeOwned + Serialize>(bytes: &[u8]) -> Result<T> {
    let t = parse(bytes).map_err(|_| Error::Unavailable)?;
    if emit(&t).map_err(|_| Error::Unavailable)? != bytes {
        return Err(Error::Unavailable);
    }
    Ok(t)
}

pub(crate) mod envelopes;
pub(crate) struct LegacyCodec;
