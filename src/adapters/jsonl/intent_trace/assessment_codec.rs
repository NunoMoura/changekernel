//! Closed assessment records and adoption-bearing anchors.
use super::super::opening::codec::{shape, Anchor};
use super::assessment_work as observation;
use crate::kernel::changes::opening::{Opened, Origin};
use crate::kernel::changes::{
    assessment::{Assessed, Assessment, Evidence, CHECK, EVALUATOR, POLICY},
    intent_trace::{Request, Revised},
};
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
pub(super) struct AssessmentOrigin {
    pub v: u64,
    pub custody: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: Option<String>,
    pub kind: String,
    pub input: Request,
    pub result: Opened,
}
shape!(AssessmentOrigin { v:u64,custody:String,workspace_id:String,binding:String,change:String,seq:u64,prev:Option<String>,kind:String,input:Request,result:Opened });
impl AssessmentOrigin {
    pub fn origin(self) -> Origin {
        Origin {
            v: self.v,
            custody: self.custody,
            workspace_id: self.workspace_id,
            binding: self.binding,
            change: self.change,
            seq: self.seq,
            prev: self.prev,
            kind: self.kind,
            input: self.input.opening(),
            result: self.result,
        }
    }
}
shape!(Evidence {
    intent: String,
    field: String,
    utf8_bytes: u64,
    limit: u64
});
shape!(Assessed {
    v: u64,
    kind: String,
    workspace_id: String,
    change: String,
    key: String,
    actor: String,
    result: String,
    seq: u64,
    intent: String,
    policy: String,
    check: String,
    evaluator: String,
    passed: bool,
    feedback: String,
    evidence: Evidence
});
shape!(Assessment {
    v: u64,
    custody: String,
    workspace_id: String,
    binding: String,
    change: String,
    seq: u64,
    prev: String,
    kind: String,
    input: Request,
    result: Assessed
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct AdoptedAnchor {
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
    pub policy: String,
    pub check: String,
    pub evaluator: String,
    pub adopter: String,
}
shape!(AdoptedAnchor {
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
    stage: String,
    policy: String,
    check: String,
    evaluator: String,
    adopter: String
});
impl AdoptedAnchor {
    pub fn new(a: &Anchor) -> Self {
        Self {
            format: a.format.clone(),
            custody: a.custody.clone(),
            workspace_id: a.workspace_id.clone(),
            binding: a.binding.clone(),
            change: a.change.clone(),
            owner: a.owner.clone(),
            key: a.key.clone(),
            directory: a.directory.clone(),
            directory_device: a.directory_device,
            directory_inode: a.directory_inode,
            lock_device: a.lock_device,
            lock_inode: a.lock_inode,
            stage: a.stage.clone(),
            policy: POLICY.into(),
            check: CHECK.into(),
            evaluator: EVALUATOR.into(),
            adopter: "owner-1".into(),
        }
    }
    pub fn base(self) -> Result<Anchor, ()> {
        observation::field_attempt(64);
        let adopted = self.policy == POLICY
            && self.check == CHECK
            && self.evaluator == EVALUATOR
            && self.adopter == "owner-1";
        observation::field_complete(adopted);
        if !adopted {
            return Err(());
        }
        Ok(Anchor {
            format: self.format,
            custody: self.custody,
            workspace_id: self.workspace_id,
            binding: self.binding,
            change: self.change,
            owner: self.owner,
            key: self.key,
            directory: self.directory,
            directory_device: self.directory_device,
            directory_inode: self.directory_inode,
            lock_device: self.lock_device,
            lock_inode: self.lock_inode,
            stage: self.stage,
        })
    }
}
pub(super) enum ResultUnion {
    Revised(Revised),
    Assessed(Assessed),
}
impl Serialize for ResultUnion {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Revised(r) => r.serialize(s),
            Self::Assessed(r) => r.serialize(s),
        }
    }
}
impl<'de> Deserialize<'de> for ResultUnion {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Fixed;
        impl<'de> Visitor<'de> for Fixed {
            type Value = ResultUnion;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("closed result union")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut m: M) -> Result<Self::Value, M::Error> {
                let (mut v, mut seq) = (None, None);
                let (
                    mut kind,
                    mut workspace_id,
                    mut change,
                    mut key,
                    mut actor,
                    mut result,
                    mut intent,
                    mut previous_intent,
                    mut policy,
                    mut check,
                    mut evaluator,
                    mut feedback,
                ) = (
                    None, None, None, None, None, None, None, None, None, None, None, None,
                );
                let (mut passed, mut evidence) = (None, None);
                let mut seen = 0u32;
                while let Some(k) = m.next_key::<String>()? {
                    observation::member_attempt(&k);
                    let bit = match k.as_str() {
                        "v" => 1,
                        "kind" => 2,
                        "workspace_id" => 4,
                        "change" => 8,
                        "key" => 16,
                        "actor" => 32,
                        "result" => 64,
                        "seq" => 128,
                        "intent" => 256,
                        "previous_intent" => 512,
                        "policy" => 1024,
                        "check" => 2048,
                        "evaluator" => 4096,
                        "passed" => 8192,
                        "feedback" => 16384,
                        "evidence" => 32768,
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
                        128 => seq = Some(m.next_value::<u64>()?),
                        8192 => passed = Some(m.next_value::<bool>()?),
                        32768 => evidence = Some(m.next_value::<Evidence>()?),
                        _ => {
                            let slot = match bit {
                                2 => &mut kind,
                                4 => &mut workspace_id,
                                8 => &mut change,
                                16 => &mut key,
                                32 => &mut actor,
                                64 => &mut result,
                                256 => &mut intent,
                                512 => &mut previous_intent,
                                1024 => &mut policy,
                                2048 => &mut check,
                                4096 => &mut evaluator,
                                16384 => &mut feedback,
                                _ => unreachable!(),
                            };
                            *slot = Some(m.next_value::<String>()?);
                        }
                    }
                }
                macro_rules! req {
                    ($x:ident) => {
                        $x.ok_or_else(|| de::Error::missing_field(stringify!($x)))?
                    };
                }
                observation::field_attempt(0);
                let kind: String = match kind {
                    Some(kind) => {
                        observation::field_complete(true);
                        kind
                    }
                    None => {
                        observation::field_complete(false);
                        return Err(de::Error::missing_field("kind"));
                    }
                };
                observation::field_attempt(64);
                match kind.as_str() {
                    "intent_revised" if seen == 1023 => {
                        observation::field_complete(true);
                        Ok(ResultUnion::Revised(Revised {
                            v: req!(v),
                            kind,
                            workspace_id: req!(workspace_id),
                            change: req!(change),
                            key: req!(key),
                            actor: req!(actor),
                            result: req!(result),
                            seq: req!(seq),
                            intent: req!(intent),
                            previous_intent: req!(previous_intent),
                        }))
                    }
                    "intent_assessed" if seen == 65023 => {
                        observation::field_complete(true);
                        Ok(ResultUnion::Assessed(Assessed {
                            v: req!(v),
                            kind,
                            workspace_id: req!(workspace_id),
                            change: req!(change),
                            key: req!(key),
                            actor: req!(actor),
                            result: req!(result),
                            seq: req!(seq),
                            intent: req!(intent),
                            policy: req!(policy),
                            check: req!(check),
                            evaluator: req!(evaluator),
                            passed: req!(passed),
                            feedback: req!(feedback),
                            evidence: req!(evidence),
                        }))
                    }
                    _ => {
                        observation::field_complete(false);
                        Err(de::Error::custom("result shape"))
                    }
                }
            }
        }
        d.deserialize_map(Fixed)
    }
}
pub(super) struct Operation {
    pub v: u64,
    pub custody: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: String,
    pub kind: String,
    pub input: Request,
    pub result: ResultUnion,
}
shape!(Operation {
    v: u64,
    custody: String,
    workspace_id: String,
    binding: String,
    change: String,
    seq: u64,
    prev: String,
    kind: String,
    input: Request,
    result: ResultUnion
});
