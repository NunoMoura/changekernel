use super::super::opening::codec::shape;
use super::assessment_work as observation;
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
impl Prefix {
    pub(crate) fn payload(&self) -> u64 {
        (self.format.len()
            + self.custody.len()
            + self.change.len()
            + self.sha256.as_ref().map_or(0, String::len)) as u64
            + self
                .pending
                .as_ref()
                .map_or(0, |p| p.input.payload() + p.actor.len() as u64)
    }
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
                let mut check = None;
                let (mut op, mut workspace_id, mut change, mut key, mut expected_intent, mut what) =
                    (None, None, None, None, None, None);
                let (mut why, mut at): (Option<Option<String>>, Option<Option<String>>) =
                    (None, None);
                let mut seen = 0u16;
                while let Some(k) = m.next_key::<String>()? {
                    observation::member_attempt(&k);
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
                        "check" => 512,
                        _ => {
                            observation::member_complete(false);
                            return Err(de::Error::custom("unknown field"));
                        }
                    };
                    observation::member_complete(true);
                    observation::field_attempt(0);
                    let duplicate = seen & bit != 0;
                    observation::field_complete(!duplicate);
                    if duplicate {
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
                        512 => check = Some(m.next_value::<String>()?),
                        _ => unreachable!(),
                    }
                }
                observation::field_attempt(0);
                let v = match v {
                    Some(v) => {
                        observation::field_complete(true);
                        v
                    }
                    None => {
                        observation::field_complete(false);
                        return Err(de::Error::missing_field("v"));
                    }
                };
                observation::field_attempt(0);
                let op: String = match op {
                    Some(op) => {
                        observation::field_complete(true);
                        op
                    }
                    None => {
                        observation::field_complete(false);
                        return Err(de::Error::missing_field("op"));
                    }
                };
                observation::field_attempt(128);
                let mask = match (v, op.as_str()) {
                    (1, "open_change") => 223,
                    (1, "inspect_change") => 15,
                    (2 | 3, "revise_intent") => 255,
                    (2 | 3, "inspect_intent") => 271,
                    (3, "inspect_assessment") => 271,
                    (3, "assess_intent") => 575,
                    _ => {
                        observation::field_complete(false);
                        return Err(de::Error::custom("unknown request pair"));
                    }
                };
                observation::field_complete(true);
                observation::field_attempt(0);
                let matching = seen == mask;
                observation::field_complete(matching);
                if !matching {
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
                    check,
                };
                observation::field_attempt(512);
                let valid = r.valid() || crate::kernel::changes::assessment::valid(&r);
                observation::field_complete(valid);
                if !valid {
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
                "inspect_intent" | "inspect_assessment" => 5,
                "assess_intent" => 7,
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
        if let Some(v) = &self.check {
            o.serialize_field("check", v)?;
        }
        o.end()
    }
}
