use super::super::opening::codec::shape;
use crate::kernel::changes::intent_trace::{Request, Revised, Revision};
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
shape!(Revised {
    v: u64,
    kind: String,
    workspace_id: String,
    change: String,
    key: String,
    actor: String,
    result: String,
    seq: u64,
    intent: String,
    previous_intent: String
});
shape!(Revision {
    v: u64,
    custody: String,
    workspace_id: String,
    binding: String,
    change: String,
    seq: u64,
    prev: String,
    kind: String,
    input: Request,
    result: Revised
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Pending {
    pub input: Request,
    pub actor: String,
}
shape!(Pending {
    input: Request,
    actor: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Prefix {
    pub format: String,
    pub custody: String,
    pub change: String,
    pub generation: u64,
    pub end: u64,
    pub sha256: Option<String>,
    pub pending: Option<Pending>,
}
shape!(Prefix { format:String, custody:String, change:String, generation:u64, end:u64, sha256:Option<String>, pending:Option<Pending> });
impl<'de> Deserialize<'de> for Request {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Fixed;
        impl<'de> Visitor<'de> for Fixed {
            type Value = Request;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed intent request union")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Request, M::Error> {
                let mut v = None;
                let (mut op, mut workspace_id, mut change, mut key, mut expected_intent, mut what) =
                    (None, None, None, None, None, None);
                let (mut why, mut at): (Option<Option<String>>, Option<Option<String>>) =
                    (None, None);
                let mut seen = 0u16;
                while let Some(k) = m.next_key::<String>()? {
                    let bit = match k.as_str() {
                        "v" => 1,
                        "op" => 2,
                        "workspace_id" => 4,
                        "change" => 8,
                        "key" => 16,
                        "expected_intent" => 32,
                        "what" => 64,
                        "why" => 128,
                        "at" => 256,
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
                        32 => expected_intent = Some(m.next_value::<String>()?),
                        64 => what = Some(m.next_value::<String>()?),
                        128 => why = Some(m.next_value::<Option<String>>()?),
                        256 => at = Some(m.next_value::<Option<String>>()?),
                        _ => unreachable!(),
                    }
                }
                let v = v.ok_or_else(|| de::Error::missing_field("v"))?;
                let op: String = op.ok_or_else(|| de::Error::missing_field("op"))?;
                let mask = match (v, op.as_str()) {
                    (1, "open_change") => 223,
                    (1, "inspect_change") => 15,
                    (2, "revise_intent") => 255,
                    (2, "inspect_intent") => 271,
                    _ => return Err(de::Error::custom("unknown request pair")),
                };
                if seen != mask {
                    return Err(de::Error::custom("wrong field set"));
                }
                let r = Request {
                    v,
                    op,
                    workspace_id: workspace_id
                        .ok_or_else(|| de::Error::missing_field("workspace_id"))?,
                    change: change.ok_or_else(|| de::Error::missing_field("change"))?,
                    key,
                    expected_intent,
                    what,
                    why,
                    at,
                };
                if !r.valid() {
                    return Err(de::Error::custom("invalid request value"));
                }
                Ok(r)
            }
        }
        d.deserialize_map(Fixed)
    }
}
impl Serialize for Request {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct(
            "request",
            match self.op.as_str() {
                "open_change" => 7,
                "revise_intent" => 8,
                "inspect_intent" => 5,
                _ => 4,
            },
        )?;
        o.serialize_field("v", &self.v)?;
        o.serialize_field("op", &self.op)?;
        o.serialize_field("workspace_id", &self.workspace_id)?;
        o.serialize_field("change", &self.change)?;
        if let Some(v) = &self.key {
            o.serialize_field("key", v)?;
        }
        if let Some(v) = &self.expected_intent {
            o.serialize_field("expected_intent", v)?;
        }
        if let Some(v) = &self.what {
            o.serialize_field("what", v)?;
        }
        if let Some(v) = &self.why {
            o.serialize_field("why", v)?;
        }
        if let Some(v) = &self.at {
            o.serialize_field("at", v)?;
        }
        o.end()
    }
}
